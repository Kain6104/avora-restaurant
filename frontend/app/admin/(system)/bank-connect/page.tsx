'use client';

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { getAuthHeaders } from '@/lib/auth';
import {
  formatVietnamDate,
  formatVietnamDateTime,
  formatVietnamTime,
} from '@/lib/utils/vietnam-time';
import { QRCodeSVG } from 'qrcode.react';
import io, { Socket } from 'socket.io-client';
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  QrCode,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  ExternalLink,
  Trash2,
  Activity,
  Layers,
  Lock,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Info,
} from 'lucide-react';

interface DeviceItem {
  id: string;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED';
  lastHeartbeatAt: string | null;
  lastIp: string | null;
  pairedAt: string;
  _count?: { transactions: number };
}

interface TransactionItem {
  id: string;
  eventId: string;
  bank: string;
  accountNumberMasked: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceAfter: number | null;
  currency: string;
  occurredAt: string;
  counterparty: string | null;
  transferContent: string | null;
  bankReference: string | null;
  matchingStatus: 'MATCHED' | 'UNMATCHED' | 'REVIEW_REQUIRED' | 'DUPLICATE' | 'IGNORED';
  orderId?: string | null;
  order?: {
    id: string;
    orderCode: string | null;
    temporaryOrderCode: string | null;
    totalAmount: number;
    paymentStatus: string;
    customerName: string;
  } | null;
}

export default function BankConnectAdminPage() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'devices' | 'history'>('monitor');
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveConnected, setLiveConnected] = useState<boolean>(false);

  // Pairing Modal State
  const [isPairingModalOpen, setIsPairingModalOpen] = useState<boolean>(false);
  const [pairingData, setPairingData] = useState<{
    code: string;
    expiresAt: string;
    serverUrl: string;
  } | null>(null);
  const [pairedSuccessData, setPairedSuccessData] = useState<{
    deviceId: string;
    deviceName: string;
    pairedAt?: string;
  } | null>(null);
  const [countdown, setCountdown] = useState<number>(300);
  const [pairingLoading, setPairingLoading] = useState<boolean>(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Manual Match Modal State
  const [matchingTx, setMatchingTx] = useState<TransactionItem | null>(null);
  const [manualOrderId, setManualOrderId] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [isSubmittingMatch, setIsSubmittingMatch] = useState<boolean>(false);

  // Filters for History
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const socketRef = useRef<Socket | null>(null);

  // 1. Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [devRes, txRes] = await Promise.all([
        fetch('/api/bank-connect/v1/admin/devices', { headers: getAuthHeaders(), credentials: 'include' }),
        fetch('/api/bank-connect/v1/admin/transactions?limit=50', { headers: getAuthHeaders(), credentials: 'include' }),
      ]);

      if (devRes.ok) {
        const devData = await devRes.json();
        setDevices(devData || []);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.items || []);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu Bank Connect:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 2. Connect WebSocket to /pos namespace for live notifications
    try {
      const socket = io('/pos', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setLiveConnected(true);
      });

      socket.on('disconnect', () => {
        setLiveConnected(false);
      });

      // Lắng nghe sự kiện giao dịch mới phát hiện
      socket.on('bank.transaction.detected', (newTx: any) => {
        setTransactions((prev) => [newTx, ...prev.filter((t) => t.id !== newTx.transactionId && t.id !== newTx.id)]);
      });

      // Lắng nghe sự kiện giao dịch bị xóa (đồng bộ 2 chiều từ Android / Admin)
      socket.on('bank.transaction.deleted', (delPayload: any) => {
        setTransactions((prev) =>
          prev.filter((t) => t.id !== delPayload.id && t.eventId !== delPayload.eventId)
        );
      });

      // Lắng nghe sự kiện dọn dẹp toàn bộ giao dịch rác
      socket.on('bank.transactions.all_unmatched_deleted', () => {
        fetchData();
      });

      // Lắng nghe sự kiện đối soát thành công
      socket.on('bank.transaction.matched', (matchedPayload: any) => {
        setTransactions((prev) =>
          prev.map((t) =>
            t.orderId === matchedPayload.orderId || t.bankReference === matchedPayload.transactionRef
              ? { ...t, matchingStatus: 'MATCHED', orderId: matchedPayload.orderId }
              : t
          )
        );
      });

      // Lắng nghe sự kiện cần đối soát thủ công
      socket.on('bank.transaction.review_required', (reviewPayload: any) => {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === reviewPayload.transactionId ? { ...t, matchingStatus: 'REVIEW_REQUIRED' } : t
          )
        );
      });

      // Lắng nghe heartbeat
      socket.on('bank.device.heartbeat', (hb: any) => {
        setDevices((prev) =>
          prev.map((d) =>
            d.deviceId === hb.deviceId ? { ...d, lastHeartbeatAt: hb.lastHeartbeatAt } : d
          )
        );
      });

      // Lắng nghe thiết bị mới online hoặc ghép nối thành công
      socket.on('bank.device.online', (payload: any) => {
        fetchData();
        if (payload?.deviceId) {
          setPairedSuccessData({
            deviceId: payload.deviceId,
            deviceName: payload.deviceName || 'Android Gateway',
            pairedAt: payload.pairedAt,
          });
        }
      });

      // Lắng nghe sự kiện ghép nối thành công
      socket.on('bank.device.paired', (payload: any) => {
        fetchData();
        if (payload?.deviceId) {
          setPairedSuccessData({
            deviceId: payload.deviceId,
            deviceName: payload.deviceName || 'Android Gateway',
            pairedAt: payload.pairedAt,
          });
          toast.success(`Ghép nối thành công thiết bị ${payload.deviceName || payload.deviceId}!`);
        }
      });

      return () => {
        socket.disconnect();
      };
    } catch (e) {
      console.warn('Socket connect failed:', e);
    }
  }, []);

  // 3. Countdown timer for pairing code
  useEffect(() => {
    if (!pairingData || !isPairingModalOpen) return;
    const interval = setInterval(() => {
      const exp = new Date(pairingData.expiresAt).getTime();
      const now = Date.now();
      const remainingSec = Math.max(0, Math.floor((exp - now) / 1000));
      setCountdown(remainingSec);
      if (remainingSec <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pairingData, isPairingModalOpen]);

  // 3.1. Polling kiểm tra trạng thái ghép nối khi Modal đang mở (đảm bảo cập nhật ngay cả khi socket trễ)
  useEffect(() => {
    if (!isPairingModalOpen || !pairingData?.code || pairedSuccessData) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/bank-connect/v1/admin/pairing-status?code=${encodeURIComponent(pairingData.code)}`,
          { headers: getAuthHeaders(), credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.paired && data.device) {
            setPairedSuccessData({
              deviceId: data.device.deviceId,
              deviceName: data.device.deviceName,
              pairedAt: data.device.pairedAt,
            });
            fetchData();
            toast.success(`Ghép nối thành công thiết bị ${data.device.deviceName}!`);
          }
        }
      } catch (e) {
        // bỏ qua lỗi polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPairingModalOpen, pairingData, pairedSuccessData]);

  // Generate pairing code
  const handleOpenPairingModal = async () => {
    setIsPairingModalOpen(true);
    setPairingLoading(true);
    setPairingError(null);
    setPairingData(null);
    setPairedSuccessData(null);
    try {
      const headers = getAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/bank-connect/v1/admin/generate-pairing-code', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPairingData(data);
        const exp = new Date(data.expiresAt).getTime();
        setCountdown(Math.max(0, Math.floor((exp - Date.now()) / 1000)));
        toast.success('Đã tạo mã ghép nối thành công!');
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.message || ('Không thể tạo mã ghép nối từ VPS (Mã ' + res.status + ')');
        setPairingError(msg);
        toast.error(msg);
      }
    } catch (e: any) {
      console.error('Lỗi tạo mã pairing:', e);
      const msg = 'Lỗi kết nối máy chủ VPS: ' + (e?.message || 'Không thể kết nối');
      setPairingError(msg);
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setPairingLoading(false);
    }
  };

  // Revoke device
  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm(`Bạn có chắc chắn muốn thu hồi quyền truy cập của thiết bị ${deviceId}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/bank-connect/v1/admin/devices/${deviceId}/revoke`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ reason: 'Admin revoked from Web Dashboard' }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error('Lỗi thu hồi thiết bị:', e);
    }
  };

  // Manual Match
  const handleManualMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchingTx || !manualOrderId.trim()) return;

    setIsSubmittingMatch(true);
    try {
      const res = await fetch(`/api/bank-connect/v1/admin/transactions/${matchingTx.id}/manual-match`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          orderId: manualOrderId.trim(),
          notes: manualNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        alert('Đã khớp đơn hàng thành công!');
        setMatchingTx(null);
        setManualOrderId('');
        setManualNotes('');
        fetchData();
      } else {
        const err = await res.json();
        alert(`Không thể khớp đơn: ${err.message || 'Lỗi không xác định'}`);
      }
    } catch (e: any) {
      alert(`Lỗi kết nối: ${e.message}`);
    } finally {
      setIsSubmittingMatch(false);
    }
  };

  // Xóa giao dịch không gắn đơn (đồng bộ realtime)
  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này khỏi hệ thống?')) return;
    try {
      const res = await fetch(`/api/bank-connect/v1/admin/transactions/${txId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        setTransactions((prev) => prev.filter((t) => t.id !== txId && t.eventId !== txId));
        toast.success('Đã xóa giao dịch thành công');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Lỗi khi xóa giao dịch');
      }
    } catch (e: any) {
      toast.error(`Lỗi kết nối: ${e.message}`);
    }
  };

  // Bắn lệnh cập nhật OTA xuống Android Gateway
  const handlePushOtaUpdate = async (deviceId?: string) => {
    try {
      const res = await fetch('/api/bank-connect/v1/admin/devices/push-update', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        toast.success('🚀 Đã bắn lệnh cập nhật OTA xuống điện thoại thành công!');
      } else {
        toast.error('Lỗi khi gửi lệnh OTA');
      }
    } catch (e: any) {
      toast.error(`Lỗi: ${e.message}`);
    }
  };

  // Copy code
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Stats calculation
  const totalCreditToday = transactions
    .filter((t) => t.direction === 'CREDIT')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalDebitToday = transactions
    .filter((t) => t.direction === 'DEBIT')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const matchedCount = transactions.filter((t) => t.matchingStatus === 'MATCHED').length;
  const reviewCount = transactions.filter((t) => t.matchingStatus === 'REVIEW_REQUIRED').length;
  const activeDevicesCount = devices.filter((d) => d.status === 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-200">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                AVORA Bank Connect
              </h1>
              <p className="text-sm text-slate-500">
                Cổng giám sát biến động số dư Vietcombank thời gian thực (VCB: <span className="font-semibold text-red-600">1019224767</span>)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            liveConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {liveConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {liveConnected ? 'WebSocket Live' : 'Đang kết nối lại'}
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenPairingModal}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm shadow-md shadow-red-200 transition"
          >
            <QrCode className="w-4 h-4" />
            Ghép nối Android mới
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Thiết bị Gateway</span>
            <Smartphone className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {activeDevicesCount} <span className="text-sm font-normal text-slate-500">/ {devices.length} hoạt động</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${activeDevicesCount > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {activeDevicesCount > 0 ? 'Hệ thống sẵn sàng tiếp nhận' : 'Chưa có Android kết nối'}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Tiền vào hôm nay</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            +{totalCreditToday.toLocaleString('vi-VN')} <span className="text-sm font-normal text-slate-500">đ</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Vietcombank TK: ******4767
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Đã khớp tự động</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {matchedCount} <span className="text-sm font-normal text-slate-500">giao dịch</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Cập nhật tức thì vào POS & Admin
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Cần rà soát (Review)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {reviewCount} <span className="text-sm font-normal text-slate-500">cần xử lý</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {reviewCount > 0 ? 'Cần đối soát thủ công bên dưới' : 'Tất cả đã được đối soát'}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`pb-3 px-4 font-medium text-sm transition border-b-2 flex items-center gap-2 ${
            activeTab === 'monitor'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Live Monitor ({transactions.length})
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`pb-3 px-4 font-medium text-sm transition border-b-2 flex items-center gap-2 ${
            activeTab === 'devices'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          Thiết bị Gateway ({devices.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-4 font-medium text-sm transition border-b-2 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Lịch sử giao dịch & Bộ lọc
        </button>
      </div>

      {/* TAB 1: LIVE MONITOR */}
      {activeTab === 'monitor' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900 text-base">Dòng biến động số dư Vietcombank</h2>
              <p className="text-xs text-slate-500">Cập nhật trực tiếp không cần tải lại trang</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Số tài khoản: ******4767</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Chiều</th>
                  <th className="py-3 px-4">Số tiền</th>
                  <th className="py-3 px-4">Số dư sau GD</th>
                  <th className="py-3 px-4">Người gửi & Nội dung</th>
                  <th className="py-3 px-4">Mã Ref VCB</th>
                  <th className="py-3 px-4">Đơn hàng khớp</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Chưa có giao dịch biến động số dư nào được gửi về từ Android Gateway.
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 30).map((tx) => (
                    <tr key={tx.id || tx.eventId} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                        {formatVietnamDateTime(tx.occurredAt, 'DD/MM/YYYY HH:mm:ss')}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          tx.direction === 'CREDIT'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {tx.direction === 'CREDIT' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          {tx.direction}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-semibold">
                        <span className={tx.direction === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}>
                          {tx.direction === 'CREDIT' ? '+' : '-'}
                          {Number(tx.amount).toLocaleString('vi-VN')} đ
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {tx.balanceAfter ? `${Number(tx.balanceAfter).toLocaleString('vi-VN')} đ` : '—'}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-slate-900 text-xs truncate">
                          {tx.counterparty || 'Chưa rõ người gửi'}
                        </div>
                        <div className="text-xs text-slate-500 truncate" title={tx.transferContent || ''}>
                          {tx.transferContent || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-slate-500 truncate max-w-[120px]" title={tx.bankReference || ''}>
                        {tx.bankReference || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {tx.order ? (
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900">
                              {tx.order.orderCode || tx.order.temporaryOrderCode}
                            </span>
                            <div className="text-slate-400">{tx.order.customerName}</div>
                          </div>
                        ) : tx.orderId ? (
                          <span className="text-xs font-mono text-slate-600">{tx.orderId}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa liên kết</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {tx.matchingStatus === 'MATCHED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Đã khớp
                          </span>
                        )}
                        {tx.matchingStatus === 'REVIEW_REQUIRED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Cần đối soát
                          </span>
                        )}
                        {tx.matchingStatus === 'UNMATCHED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            Chưa khớp
                          </span>
                        )}
                        {tx.matchingStatus === 'DUPLICATE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            Trùng lặp
                          </span>
                        )}
                        {tx.matchingStatus === 'IGNORED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
                            Bỏ qua
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {tx.matchingStatus === 'REVIEW_REQUIRED' && (
                            <button
                              onClick={() => {
                                setMatchingTx(tx);
                                setManualOrderId('');
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition"
                            >
                              Khớp đơn
                            </button>
                          )}
                          {!tx.orderId && tx.matchingStatus !== 'MATCHED' && (
                            <button
                              onClick={() => handleDeleteTransaction(tx.id || tx.eventId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Xóa giao dịch này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CONNECTED DEVICES */}
      {activeTab === 'devices' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 text-base">Thiết bị Android Gateway đã liên kết</h2>
              <p className="text-xs text-slate-500">Mỗi thiết bị sở hữu cặp khóa EC P-256 phần cứng và ký số mọi yêu cầu</p>
            </div>
            <button
              onClick={handleOpenPairingModal}
              className="text-xs font-medium text-red-600 hover:text-red-700 underline"
            >
              + Thêm thiết bị
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tên thiết bị</th>
                  <th className="py-3 px-4">Device ID</th>
                  <th className="py-3 px-4">Phiên bản App</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Heartbeat gần nhất</th>
                  <th className="py-3 px-4">Ngày liên kết</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Chưa có thiết bị Android nào được ghép nối. Nhấn "Ghép nối Android mới" để liên kết điện thoại.
                    </td>
                  </tr>
                ) : (
                  devices.map((dev) => (
                    <tr key={dev.id || dev.deviceId} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-slate-500" />
                        {dev.deviceName}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                        {dev.deviceId}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        v{dev.appVersion}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          dev.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {dev.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                        {dev.lastHeartbeatAt ? formatVietnamTime(dev.lastHeartbeatAt, 'HH:mm:ss') : 'Chưa có'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {formatVietnamDate(dev.pairedAt, 'DD/MM/YYYY')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {dev.status === 'ACTIVE' && (
                            <button
                              onClick={() => handlePushOtaUpdate(dev.deviceId)}
                              className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1 shadow-2xs"
                              title="Bắn lệnh cập nhật OTA xuống thiết bị"
                            >
                              🚀 Cập nhật OTA
                            </button>
                          )}
                          {dev.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleRevokeDevice(dev.deviceId)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-medium transition"
                            >
                              Thu hồi
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRANSACTION HISTORY & FILTER */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo nội dung chuyển, người gửi, mã tham chiếu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="MATCHED">Đã khớp (MATCHED)</option>
                <option value="REVIEW_REQUIRED">Cần rà soát (REVIEW)</option>
                <option value="UNMATCHED">Chưa khớp (UNMATCHED)</option>
                <option value="DUPLICATE">Trùng lặp (DUPLICATE)</option>
              </select>

              <select
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="ALL">Tất cả chiều</option>
                <option value="CREDIT">Tiền vào (CREDIT)</option>
                <option value="DEBIT">Tiền ra (DEBIT)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {transactions
              .filter((tx) => {
                if (filterStatus !== 'ALL' && tx.matchingStatus !== filterStatus) return false;
                if (filterDirection !== 'ALL' && tx.direction !== filterDirection) return false;
                if (searchQuery.trim()) {
                  const q = searchQuery.toLowerCase();
                  const matchContent = (tx.transferContent || '').toLowerCase().includes(q);
                  const matchSender = (tx.counterparty || '').toLowerCase().includes(q);
                  const matchRef = (tx.bankReference || '').toLowerCase().includes(q);
                  if (!matchContent && !matchSender && !matchRef) return false;
                }
                return true;
              })
              .map((tx) => (
                <div key={tx.id || tx.eventId} className="p-4 rounded-lg border border-slate-200/80 hover:border-slate-300 transition flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        tx.direction === 'CREDIT' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {tx.direction}
                      </span>
                      <span className="text-base font-bold text-slate-900">
                        {Number(tx.amount).toLocaleString('vi-VN')} đ
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {formatVietnamDateTime(tx.occurredAt, 'DD/MM/YYYY HH:mm:ss')}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-slate-800">
                      Người gửi: <span className="font-semibold text-slate-900">{tx.counterparty || 'Không xác định'}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                      {tx.transferContent || '(Trống)'}
                    </div>
                  </div>

                  <div className="sm:text-right flex flex-col justify-between items-start sm:items-end">
                    <div>
                      <span className="text-xs font-mono text-slate-400">Ref: {tx.bankReference || 'N/A'}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tx.matchingStatus === 'MATCHED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tx.matchingStatus === 'REVIEW_REQUIRED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {tx.matchingStatus}
                      </span>
                      {!tx.orderId && tx.matchingStatus !== 'MATCHED' && (
                        <button
                          onClick={() => handleDeleteTransaction(tx.id || tx.eventId)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Xóa giao dịch này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* PAIRING MODAL */}
      {isPairingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            {pairedSuccessData ? (
              // MODAL TÍCH XANH THÔNG BÁO GHÉP NỐI THÀNH CÔNG
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-emerald-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Ghép nối Android Gateway</h3>
                      <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Đã liên kết thành công
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsPairingModalOpen(false);
                      setPairedSuccessData(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                <div className="py-6 text-center">
                  {/* Glowing Green Checkmark */}
                  <div className="relative inline-block mb-4">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-100/70 shadow-inner">
                      <CheckCircle2 className="w-10 h-10 animate-in zoom-in duration-300" />
                    </div>
                  </div>

                  <h4 className="text-lg font-extrabold text-slate-900 mb-1">Ghép Nối Thành Công!</h4>
                  <p className="text-xs text-slate-500 mb-5 max-w-xs mx-auto leading-relaxed">
                    Thiết bị Android Gateway đã liên kết bảo mật với AVORA Server và đã sẵn sàng tự động đồng bộ biến động số dư.
                  </p>

                  {/* Device Info Card */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left space-y-2.5 mb-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Tên thiết bị:</span>
                      <span className="font-bold text-slate-800">{pairedSuccessData.deviceName}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Mã thiết bị (ID):</span>
                      <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] font-semibold">
                        {pairedSuccessData.deviceId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Trạng thái:</span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Đang hoạt động (ACTIVE)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Thời gian:</span>
                      <span className="text-slate-700 font-medium">
                        {pairedSuccessData.pairedAt
                          ? formatVietnamDateTime(pairedSuccessData.pairedAt, 'HH:mm:ss DD/MM/YYYY')
                          : 'Vừa xong'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Bảo mật kênh truyền:</span>
                      <span className="text-emerald-700 font-semibold inline-flex items-center gap-1 text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Chữ ký EC P-256
                      </span>
                    </div>
                  </div>

                  <div className="text-left bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3 text-[11.5px] text-emerald-800 mt-3 flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>
                      Thiết bị đã được phân quyền quản lý. Bất kỳ thông báo chuyển khoản nào nhận được trên máy sẽ được đối soát tự động tức thì.
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setIsPairingModalOpen(false);
                      setPairedSuccessData(null);
                      fetchData();
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-200 transition flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Hoàn tất & Bắt đầu giám sát
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Ghép nối Android Gateway</h3>
                      <p className="text-xs text-slate-500">Mã pairing có hiệu lực 5 phút</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPairingModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {pairingLoading ? (
                  <div className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-8 h-8 mx-auto animate-spin text-red-600 mb-3" />
                    <p className="font-semibold text-slate-800">Đang tạo mã pairing từ VPS...</p>
                    <p className="text-xs text-slate-400 mt-1">Đang thiết lập kênh mã hóa bảo mật với server</p>
                  </div>
                ) : pairingError ? (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">Không tạo được mã ghép nối</h4>
                    <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 mb-4 font-medium max-w-sm mx-auto">{pairingError}</p>
                    <button
                      type="button"
                      onClick={handleOpenPairingModal}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition shadow"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Thử tạo lại mã
                    </button>
                  </div>
                ) : pairingData ? (
                  <div className="py-6 text-center">
                    {/* QR Code */}
                    <div className="inline-block p-4 bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
                      <QRCodeSVG
                        value={JSON.stringify({
                          serverUrl: pairingData.serverUrl,
                          pairingCode: pairingData.code,
                          expiresAt: pairingData.expiresAt,
                        })}
                        size={180}
                        level="H"
                      />
                    </div>

                    {/* 6-character Code */}
                    <div className="mb-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">
                        Mã liên kết 6 chữ số
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-3xl font-extrabold tracking-widest text-slate-900 bg-slate-100 px-5 py-2 rounded-xl border border-slate-200">
                          {pairingData.code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(pairingData.code)}
                          className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
                          title="Sao chép mã"
                        >
                          {copiedCode ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Countdown */}
                    <div className="flex items-center justify-center gap-1.5 text-xs text-amber-700 bg-amber-50 py-1.5 px-3 rounded-full border border-amber-200/60 inline-flex mb-4">
                      <Clock className="w-3.5 h-3.5" />
                      Mã hết hạn sau: <span className="font-bold font-mono">{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
                    </div>

                    <div className="text-xs text-slate-500 text-left bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-1.5">
                      <div className="font-semibold text-slate-700">Hướng dẫn thực hiện:</div>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600">
                        <li>Mở app <strong className="text-slate-800">AVORA BANK CONNECT</strong> trên điện thoại Android</li>
                        <li>Vào mục <strong className="text-slate-800">Cấu hình kết nối</strong></li>
                        <li>Quét mã QR ở trên hoặc nhập mã 6 ký tự để hoàn tất liên kết</li>
                      </ol>
                    </div>
                  </div>
                ) : null}

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setIsPairingModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANUAL MATCH MODAL */}
      {matchingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Khớp đơn hàng thủ công</h3>
              <button
                onClick={() => setMatchingTx(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualMatchSubmit} className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-200">
                <div>Số tiền: <strong className="text-emerald-600 text-sm">{Number(matchingTx.amount).toLocaleString('vi-VN')} đ</strong></div>
                <div>Người chuyển: <strong>{matchingTx.counterparty || 'Chưa rõ'}</strong></div>
                <div>Nội dung: <span className="font-mono text-slate-600">{matchingTx.transferContent}</span></div>
                <div>Mã Ref VCB: <span className="font-mono text-slate-500">{matchingTx.bankReference || 'N/A'}</span></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã đơn hàng (Order Code hoặc Order ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: HD-261105-001 hoặc mã UUID"
                  value={manualOrderId}
                  onChange={(e) => setManualOrderId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú đối soát (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  placeholder="Lý do đối soát thủ công..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMatchingTx(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMatch}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium shadow-md shadow-red-200 transition disabled:opacity-50"
                >
                  {isSubmittingMatch ? 'Đang xử lý...' : 'Xác nhận đối soát'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

