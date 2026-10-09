/**
 * QualityManager.ts
 * Quản lý Cấp độ Đồ họa & Hiệu năng Thông minh cho AVORA Farm.
 * Hỗ trợ AUTO, LOW, MEDIUM, HIGH, ULTRA với cơ chế đo đạc FPS sampling thích ứng.
 */

export type FarmQualityTier = 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

export interface QualityBudget {
  maxAmbientParticles: number;
  petalFrequency: number;
  rainFrequency: number;
  enableWaterfallRipples: boolean;
  enableWindSway: boolean;
  burstParticleCount: number;
}

export const QUALITY_BUDGETS: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA', QualityBudget> = {
  LOW: {
    maxAmbientParticles: 40,
    petalFrequency: 1400,
    rainFrequency: 120,
    enableWaterfallRipples: false,
    enableWindSway: false,
    burstParticleCount: 6,
  },
  MEDIUM: {
    maxAmbientParticles: 80,
    petalFrequency: 800,
    rainFrequency: 65,
    enableWaterfallRipples: true,
    enableWindSway: true,
    burstParticleCount: 10,
  },
  HIGH: {
    maxAmbientParticles: 150,
    petalFrequency: 500,
    rainFrequency: 35,
    enableWaterfallRipples: true,
    enableWindSway: true,
    burstParticleCount: 16,
  },
  ULTRA: {
    maxAmbientParticles: 240,
    petalFrequency: 350,
    rainFrequency: 25,
    enableWaterfallRipples: true,
    enableWindSway: true,
    burstParticleCount: 22,
  },
};

class QualityManager {
  private currentTier: FarmQualityTier = 'AUTO';
  private effectiveTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA' = 'HIGH';
  private fpsHistory: number[] = [];
  private lastEvaluationTime = 0;
  private listeners: Array<(tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA') => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('AVORA_FARM_QUALITY') as FarmQualityTier;
      if (saved && ['AUTO', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'].includes(saved)) {
        this.currentTier = saved;
      }

      // Đánh giá phần cứng ban đầu
      this.detectInitialHardware();
    }
  }

  private detectInitialHardware() {
    if (typeof window === 'undefined') return;

    // Thiết bị di động hoặc cấu hình thấp
    const isMobile =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const memory = (navigator as any).deviceMemory; // GB RAM nếu trình duyệt hỗ trợ
    const cores = navigator.hardwareConcurrency || 4;

    if (this.currentTier === 'AUTO') {
      if (isMobile && (memory && memory <= 4)) {
        this.effectiveTier = 'LOW';
      } else if (isMobile || cores <= 4) {
        this.effectiveTier = 'MEDIUM';
      } else {
        this.effectiveTier = 'HIGH';
      }
    } else {
      this.effectiveTier = this.currentTier as any;
    }
  }

  public getTier(): FarmQualityTier {
    return this.currentTier;
  }

  public getEffectiveTier(): 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA' {
    return this.effectiveTier;
  }

  public getBudget(): QualityBudget {
    return QUALITY_BUDGETS[this.effectiveTier];
  }

  public setTier(tier: FarmQualityTier) {
    this.currentTier = tier;
    if (typeof window !== 'undefined') {
      localStorage.setItem('AVORA_FARM_QUALITY', tier);
    }
    if (tier !== 'AUTO') {
      this.effectiveTier = tier;
    } else {
      this.detectInitialHardware();
    }
    this.notifyListeners();
  }

  /**
   * Cập nhật mẫu FPS từ Phaser Scene Loop (Gọi mỗi giây 1 lần)
   */
  public sampleFPS(fps: number) {
    if (this.currentTier !== 'AUTO') return;

    const now = Date.now();
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 5) {
      this.fpsHistory.shift();
    }

    // Đánh giá định kỳ mỗi 5 giây
    if (now - this.lastEvaluationTime > 5000) {
      this.lastEvaluationTime = now;
      const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

      let newTier = this.effectiveTier;
      if (avgFps < 35 && this.effectiveTier !== 'LOW') {
        newTier = this.effectiveTier === 'ULTRA' ? 'HIGH' : this.effectiveTier === 'HIGH' ? 'MEDIUM' : 'LOW';
      } else if (avgFps > 58 && this.effectiveTier === 'LOW') {
        newTier = 'MEDIUM';
      }

      if (newTier !== this.effectiveTier) {
        this.effectiveTier = newTier;
        this.notifyListeners();
      }
    }
  }

  public onQualityChanged(listener: (tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA') => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.effectiveTier));
  }
}

export const qualityManager = new QualityManager();
