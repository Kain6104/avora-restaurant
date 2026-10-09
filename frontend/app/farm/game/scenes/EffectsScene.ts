import * as Phaser from 'phaser';
import { farmEventBus } from '../services/farmEventBus';
import { qualityManager } from '../systems/QualityManager';
import { FARM_ASSET_KEYS } from '../assets/FarmAssetRegistry';

export class EffectsScene extends Phaser.Scene {
  private petalEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fireflyEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private starEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private weatherOverlay: Phaser.GameObjects.Rectangle | null = null;

  private currentWeather = 'SUNNY';
  private unsubscribeQuality?: () => void;
  private onVisibilityChangeHandler?: () => void;

  constructor() {
    super({ key: 'EffectsScene' });
  }

  create() {
    const { width, height } = this.scale;
    const budget = qualityManager.getBudget();

    // 1. Weather Color Overlay (Screen-space tint)
    this.weatherOverlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // 2. Sakura Petals Ambient Emitter (Pooled & Budget Controlled)
    if (this.textures.exists('particle_petal')) {
      this.petalEmitter = this.add.particles(0, 0, 'particle_petal', {
        x: { min: -100, max: width + 200 },
        y: -30,
        lifespan: 7500,
        speedX: { min: 20, max: 65 },
        speedY: { min: 25, max: 75 },
        scale: { start: 0.75, end: 0.25 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 0.8, end: 0 },
        quantity: 1,
        frequency: budget.petalFrequency,
        maxAliveParticles: budget.maxAmbientParticles,
      });
      this.petalEmitter.setScrollFactor(0);
    }

    // 3. Fireflies Emitter (Ban đêm / Vườn thiền)
    if (this.textures.exists('particle_firefly')) {
      this.fireflyEmitter = this.add.particles(0, 0, 'particle_firefly', {
        x: { min: 50, max: width - 50 },
        y: { min: 100, max: height - 100 },
        lifespan: 3800,
        speedX: { min: -12, max: 12 },
        speedY: { min: -12, max: 12 },
        scale: { start: 0.55, end: 0.1 },
        alpha: { start: 0, end: 0.85 },
        frequency: 1400,
        maxAliveParticles: 25,
      });
      this.fireflyEmitter.setScrollFactor(0);
      this.fireflyEmitter.stop();
    }

    // 4. Rain Drops Emitter
    if (this.textures.exists('particle_water_drop')) {
      this.rainEmitter = this.add.particles(0, 0, 'particle_water_drop', {
        x: { min: -50, max: width + 100 },
        y: -20,
        lifespan: 1100,
        speedX: -35,
        speedY: { min: 400, max: 580 },
        scale: { start: 0.45, end: 0.18 },
        alpha: { start: 0.65, end: 0.1 },
        frequency: budget.rainFrequency,
        maxAliveParticles: budget.maxAmbientParticles * 1.5,
      });
      this.rainEmitter.setScrollFactor(0);
      this.rainEmitter.stop();
    }

    // 5. Shared Star Burst Emitter (Pooled - Không tạo destroy liên tục)
    if (this.textures.exists('particle_gold_star')) {
      this.starEmitter = this.add.particles(0, 0, 'particle_gold_star', {
        lifespan: 900,
        speed: { min: 70, max: 160 },
        scale: { start: 0.85, end: 0.1 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      });
      this.starEmitter.setScrollFactor(0);
    }

    // 6. Handle Event Bus Triggers
    farmEventBus.on('WEATHER_CHANGED', (weather: string) => {
      this.applyWeather(weather);
    });

    farmEventBus.on('TRIGGER_HARVEST_BURST', (data: { x: number; y: number; exp: number; coin: number }) => {
      this.triggerHarvestBurst(data.x, data.y, data.exp, data.coin);
    });

    // 7. Lắng nghe thay đổi Quality Tier
    this.unsubscribeQuality = qualityManager.onQualityChanged(() => {
      this.updateQualityBudget();
    });

    // 8. Tối ưu Tab Hidden: Dừng render emitter khi người dùng rời tab
    if (typeof document !== 'undefined') {
      this.onVisibilityChangeHandler = () => {
        if (document.hidden) {
          this.petalEmitter?.pause();
          this.fireflyEmitter?.pause();
          this.rainEmitter?.pause();
        } else {
          this.petalEmitter?.resume();
          this.fireflyEmitter?.resume();
          this.rainEmitter?.resume();
        }
      };
      document.addEventListener('visibilitychange', this.onVisibilityChangeHandler);
    }

    // Handle screen resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      if (this.weatherOverlay) {
        this.weatherOverlay.setSize(gameSize.width, gameSize.height);
        this.weatherOverlay.setPosition(gameSize.width / 2, gameSize.height / 2);
      }
    });
  }

  /**
   * Cập nhật tần số và giới hạn hạt theo Quality Tier
   */
  private updateQualityBudget() {
    const budget = qualityManager.getBudget();
    if (this.petalEmitter) {
      this.petalEmitter.frequency = budget.petalFrequency;
    }
    if (this.rainEmitter) {
      this.rainEmitter.frequency = budget.rainFrequency;
    }
  }

  /**
   * Thay đổi thời tiết trực quan
   */
  private applyWeather(weather: string) {
    this.currentWeather = weather;

    if (!this.weatherOverlay) return;
    const budget = qualityManager.getBudget();

    switch (weather) {
      case 'NIGHT':
        // Đêm trăng trong trẻo: lớp phủ xanh đêm 12% dịu mát, không bị chói lóa và không bị tối mù
        this.weatherOverlay.setFillStyle(0x0a1628, 0.12);
        this.fireflyEmitter?.start();
        this.rainEmitter?.stop();
        break;

      case 'SAKURA_WIND':
        this.weatherOverlay.setFillStyle(0xfce7f3, 0.1);
        if (this.petalEmitter) {
          this.petalEmitter.frequency = Math.max(120, Math.round(budget.petalFrequency * 0.4));
        }
        this.fireflyEmitter?.stop();
        this.rainEmitter?.stop();
        break;

      case 'RAIN':
        this.weatherOverlay.setFillStyle(0x1e293b, 0.25);
        this.rainEmitter?.start();
        this.fireflyEmitter?.stop();
        if (this.petalEmitter) {
          this.petalEmitter.frequency = Math.round(budget.petalFrequency * 1.8);
        }
        break;

      case 'SUNNY':
      default:
        this.weatherOverlay.setFillStyle(0xfef08a, 0.08);
        if (this.petalEmitter) {
          this.petalEmitter.frequency = budget.petalFrequency;
        }
        this.fireflyEmitter?.stop();
        this.rainEmitter?.stop();
        break;
    }
  }

  /**
   * Hiệu ứng bùng nổ gặt hái & số điểm bay lên (Tái sử dụng Emitter & Text Pooling)
   */
  private triggerHarvestBurst(screenX: number, screenY: number, exp: number, coin: number) {
    const budget = qualityManager.getBudget();

    // 1. Star burst (Gọi explode từ pooled emitter)
    if (this.starEmitter) {
      this.starEmitter.explode(budget.burstParticleCount, screenX, screenY);
    }

    // 2. Floating Numbers: +XP & +Coin (dùng biểu tượng AVORA Coin chính thức)
    const expText = this.add
      .text(screenX - 35, screenY - 20, `+${exp} EXP`, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '15px',
        color: '#34d399',
        fontStyle: 'bold',
        stroke: '#064e3b',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const coinContainer = this.add.container(screenX + 35, screenY - 20);
    const coinText = this.add
      .text(-10, 0, `+${coin}`, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '15px',
        color: '#fbbf24',
        fontStyle: 'bold',
        stroke: '#78350f',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5);
    coinContainer.add(coinText);

    if (this.textures.exists(FARM_ASSET_KEYS.UI.AVORA_COIN)) {
      const coinIcon = this.add
        .image(-4, 0, FARM_ASSET_KEYS.UI.AVORA_COIN)
        .setOrigin(0, 0.5)
        .setDisplaySize(18, 18);
      coinContainer.add(coinIcon);
    }

    this.tweens.add({
      targets: [expText, coinContainer],
      y: '-=45',
      alpha: { from: 1, to: 0 },
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        expText.destroy();
        coinContainer.destroy();
      },
    });
  }

  destroy() {
    this.unsubscribeQuality?.();
    if (typeof document !== 'undefined' && this.onVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.onVisibilityChangeHandler);
    }
  }
}
