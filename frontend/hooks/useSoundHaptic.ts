'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const LOCAL_STORAGE_KEY = 'avora_notification_sound_enabled';

class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Phát âm thanh chime tổng hợp chuẩn Web Audio API không cần file MP3
   */
  play(priority: number = 1) {
    if (priority <= 0) return; // Mức LOW: không phát âm thanh làm phiền

    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (priority === 1) {
        // NORMAL Priority: Chime 2 nốt nhẹ nhàng (G5 -> C6)
        this.playTone(ctx, 783.99, now, 0.15, 0.18);
        this.playTone(ctx, 1046.5, now + 0.12, 0.28, 0.22);
      } else if (priority === 2) {
        // HIGH Priority (Món xong, Đơn mới, Khách gọi): Chime 3 nốt vui tươi rõ ràng (E5 -> A5 -> E6)
        this.playTone(ctx, 659.25, now, 0.12, 0.22);
        this.playTone(ctx, 880.0, now + 0.1, 0.15, 0.25);
        this.playTone(ctx, 1318.51, now + 0.22, 0.35, 0.28);
      } else {
        // CRITICAL Priority: Âm thanh cảnh báo khẩn cấp (Hợp âm kép rung)
        this.playTone(ctx, 523.25, now, 0.18, 0.3, 'sawtooth');
        this.playTone(ctx, 783.99, now + 0.12, 0.25, 0.3, 'sine');
        this.playTone(ctx, 1046.5, now + 0.25, 0.4, 0.35, 'triangle');
      }
    } catch {
      // Browser autoplay policy might restrict before user gesture
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

const synthesizer = new SoundSynthesizer();

export function useSoundHaptic() {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const userInteractedRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored !== null) {
      setSoundEnabledState(stored === 'true');
    }

    // Tự động mở khóa AudioContext sau lần chạm/click đầu tiên
    const unlockAudio = () => {
      userInteractedRef.current = true;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const tempCtx = new AudioCtx();
        tempCtx.resume().then(() => tempCtx.close()).catch(() => {});
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(enabled));
    }
  }, []);

  const playSound = useCallback(
    (priority: number = 1) => {
      if (!soundEnabled) return;
      synthesizer.play(priority);
    },
    [soundEnabled],
  );

  const triggerHaptic = useCallback((pattern: number | number[] = [80]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Fallback gracefully on devices without vibration support (e.g. iOS)
      }
    }
  }, []);

  return {
    soundEnabled,
    setSoundEnabled,
    playSound,
    triggerHaptic,
  };
}
