import * as Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Tải trước hình nền nông trại để PreloadScene hiển thị ngay lập tức với chất lượng hình ảnh cao nhất
    this.load.image('preload_bg', '/game/farm/backgrounds/avora-farm-day.webp');
  }

  create() {
    // 1. Quality Tier Auto-Detection
    const nav: any = typeof navigator !== 'undefined' ? navigator : {};
    const memory = nav.deviceMemory || 4; // in GB
    const hardwareConcurrency = nav.hardwareConcurrency || 4;

    let quality = 'MEDIUM';
    if (memory >= 8 && hardwareConcurrency >= 8) {
      quality = 'ULTRA';
    } else if (memory >= 6 && hardwareConcurrency >= 4) {
      quality = 'HIGH';
    } else if (memory < 4 || hardwareConcurrency <= 2) {
      quality = 'LOW';
    }

    this.registry.set('quality', quality);
    console.log(`🎮 AVORA Farm Engine Initialized. Quality Tier: [${quality}]`);

    // 2. Chuyển tiếp tới PreloadScene để tải file assets thật
    this.scene.start('PreloadScene');
  }
}
