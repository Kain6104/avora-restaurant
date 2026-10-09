'use client';

import React, { useEffect, useState } from 'react';
import { farmEventBus } from '../../game/services/farmEventBus';
import { Sparkles } from 'lucide-react';

interface FloatingExpItem {
  id: string;
  amount: number;
  startX: number;
  startY: number;
}

export default function FloatingExpOverlay() {
  const [items, setItems] = useState<FloatingExpItem[]>([]);

  useEffect(() => {
    const unsub = farmEventBus.on(
      'XP_GAINED',
      (data: { amount: number; x?: number; y?: number }) => {
        if (!data.amount || data.amount <= 0) return;

        const id = `${Date.now()}_${Math.random()}`;
        const startX = data.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
        const startY = data.y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 400);

        setItems((prev) => [...prev, { id, amount: data.amount, startX, startY }]);

        // Tự động xóa hạt sau khi hoàn tất hoạt cảnh (1.4 giây)
        setTimeout(() => {
          setItems((prev) => prev.filter((item) => item.id !== id));
        }, 1400);
      },
    );

    return () => unsub();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-[#3e2723] font-black text-xs sm:text-sm shadow-[0_4px_16px_rgba(255,183,3,0.6)] border-2 border-white animate-expFloat"
          style={{
            left: `${item.startX}px`,
            top: `${item.startY}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-800 animate-spin" style={{ animationDuration: '2s' }} />
          <span>+{item.amount} EXP</span>
        </div>
      ))}
      <style jsx global>{`
        @keyframes expFloatAnim {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.6);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -30px) scale(1.15);
          }
          60% {
            opacity: 1;
            transform: translate(-50%, -65px) scale(1);
          }
          100% {
            opacity: 0;
            /* Bay chếch về góc trên-trái (nơi thanh EXP HUD ngự trị) */
            transform: translate(-140px, -180px) scale(0.7);
          }
        }
        .animate-expFloat {
          animation: expFloatAnim 1.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}
