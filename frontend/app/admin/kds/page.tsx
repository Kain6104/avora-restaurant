"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChefHat,
  Store,
  Clock,
  Wifi,
  WifiOff,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  RotateCcw,
  ArrowLeft,
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  Sparkles,
  Flame,
  Fish,
  Wine,
  IceCream,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PosBranch } from '@/components/pos/pos-types';
import { KitchenKdsPanel } from '@/components/pos/KitchenKdsPanel';
import { usePosSocket } from '@/components/pos/usePosSocket';

export default function AdminKdsPage() {
  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [branches, setBranches] = useState<PosBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<PosBranch | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  // Clock
  useEffect(() => {
    const update = () => {
      setTimeStr(
        new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio chime for new ticket
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }, [soundEnabled]);

  // Fetch branches
  useEffect(() => {
    const fetchInit = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/pos/init`, { credentials: 'include' });
        const json = await res.json();
        if (json.success && json.data) {
          setBranches(json.data.branches || []);
          if (json.data.currentBranch) {
            setCurrentBranch(json.data.currentBranch);
          }
        }
      } catch (e) {
        console.error('Failed to init KDS:', e);
      }
    };
    fetchInit();
  }, [baseUrl]);

  // Fetch tickets for current branch
  const fetchTickets = useCallback(async () => {
    if (!currentBranch) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/kitchen/tickets?branchId=${currentBranch.id}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTickets(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch kitchen tickets:', e);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, currentBranch]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Realtime WebSocket integration
  const handleSocketKitchenTicket = useCallback(
    (ticket: any) => {
      playChime();
      toast.success(`Món mới cho ${ticket.tableName || 'đơn hàng'}!`, {
        icon: <ChefHat className="w-4 h-4 text-amber-500" />,
        duration: 3000,
      });
      fetchTickets();
    },
    [playChime, fetchTickets],
  );

  const { connectionStatus } = usePosSocket({
    branchId: currentBranch?.id,
    onKitchenTicketNew: handleSocketKitchenTicket,
    onOrderUpdated: () => fetchTickets(),
  });

  // Update Item Status
  const handleUpdateItemStatus = async (itemId: string, status: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/pos/kitchen/items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        fetchTickets();
      }
    } catch (e) {
      toast.error('Không thể cập nhật trạng thái món');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans select-none">

      {/* KDS Professional Top Header */}
      <header className="h-14 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left: Brand & Station Identity */}
        <div className="flex items-center gap-3">
          <Image
            src="/avora_logo_ngang.png"
            alt="AVORA"
            width={100}
            height={28}
            className="h-7 w-auto object-contain brightness-200"
          />

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-amber-400" />
            <span className="font-extrabold text-sm tracking-wide text-white uppercase">
              KDS • Màn Hình Bếp
            </span>
          </div>

          {/* Branch Switcher */}
          <select
            value={currentBranch?.id || ''}
            onChange={(e) => {
              const b = branches.find((item) => item.id === e.target.value) || null;
              setCurrentBranch(b);
            }}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 outline-none font-semibold cursor-pointer"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Quick Controls, Clock, Fullscreen, Back to POS */}
        <div className="flex items-center gap-2.5">
          {/* Audio Chime Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={soundEnabled ? 'Âm thanh thông báo: Đang bật' : 'Âm thanh thông báo: Đã tắt'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchTickets}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            title="Làm mới vé bếp"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Live Clock */}
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-amber-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{timeStr}</span>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            title="Toàn màn hình KDS"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Back to POS */}
          <Link
            href="/admin/pos"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#da251d] hover:bg-[#b81d16] text-white rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Về POS Bán Hàng</span>
          </Link>
        </div>
      </header>

      {/* Main KDS Workspace */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <KitchenKdsPanel
          branchId={currentBranch?.id || ''}
          tickets={tickets}
          onUpdateItemStatus={handleUpdateItemStatus}
          onRefresh={fetchTickets}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}
