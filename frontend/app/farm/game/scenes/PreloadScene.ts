import * as Phaser from 'phaser';
import { FULL_FARM_ASSET_MANIFEST } from '../assets/FarmAssetManifest';
import { farmEventBus } from '../services/farmEventBus';

export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressGlow!: Phaser.GameObjects.Graphics;
  private progressSparkle!: Phaser.GameObjects.Graphics;
  private percentText!: Phaser.GameObjects.Text;
  private tipText!: Phaser.GameObjects.Text;
  private assetCountText!: Phaser.GameObjects.Text;
  private loadingCardContainer!: Phaser.GameObjects.Container;
  private particles: Phaser.GameObjects.Graphics[] = [];
  private currentProgress: number = 0;
  private targetProgress: number = 0;
  private totalAssetsCount: number = 0;
  private loadedAssetsCount: number = 0;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    const { width, height } = this.scale;
    this.totalAssetsCount = FULL_FARM_ASSET_MANIFEST.length;

    // =========================================================================
    // 1. HÌNH NỀN TIÊN CẢNH SỐNG ĐỘNG (CINEMATIC PARALLAX BACKGROUND)
    // =========================================================================
    if (this.textures.exists('preload_bg')) {
      const bgImg = this.add.image(width / 2, height / 2, 'preload_bg').setOrigin(0.5);
      const scaleX = width / bgImg.width;
      const scaleY = height / bgImg.height;
      const baseScale = Math.max(scaleX, scaleY);
      bgImg.setScale(baseScale);

      // Hiệu ứng zoom/thở camera điện ảnh nhẹ nhàng
      this.tweens.add({
        targets: bgImg,
        scaleX: baseScale * 1.05,
        scaleY: baseScale * 1.05,
        duration: 12000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      // Fallback: Gradient bầu trời thần tiên đa sắc
      const bgGradient = this.add.graphics();
      bgGradient.fillGradientStyle(0x0f172a, 0x1e1b4b, 0x064e3b, 0x1c1917, 1);
      bgGradient.fillRect(0, 0, width, height);
    }

    // Lớp phủ ánh tối điện ảnh (Cinematic Vignette) làm nổi bật trung tâm
    const vignette = this.add.graphics();
    vignette.fillStyle(0x0a0c10, 0.52);
    vignette.fillRect(0, 0, width, height);

    // =========================================================================
    // 2. HIỆU ỨNG ĐOM ĐÓM & CÁNH HOA ANH ĐÀO LUNG LINH (MAGICAL PARTICLES)
    // =========================================================================
    // A. Đom đóm ánh vàng ngọc bích bay lượn
    const particleColors = [0xfde047, 0xf59e0b, 0x34d399, 0xa7f3d0, 0x67e8f9];
    for (let i = 0; i < 26; i++) {
      const p = this.add.graphics();
      const color = particleColors[i % particleColors.length];
      const radius = Phaser.Math.Between(2, 4);

      p.fillStyle(color, 0.9);
      p.fillCircle(0, 0, radius);
      p.setPosition(Phaser.Math.Between(20, width - 20), Phaser.Math.Between(40, height - 40));

      this.tweens.add({
        targets: p,
        y: `-=${Phaser.Math.Between(60, 160)}`,
        x: `+=${Phaser.Math.Between(-35, 35)}`,
        alpha: { from: 0.15, to: 0.95 },
        duration: Phaser.Math.Between(2800, 5200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2000),
      });

      this.particles.push(p);
    }

    // B. Cánh hoa đào hồng phai rơi nhẹ
    for (let i = 0; i < 14; i++) {
      const petal = this.add.graphics();
      petal.fillStyle(0xfbcfe8, 0.75);
      petal.fillEllipse(0, 0, 8, 4);
      petal.setPosition(Phaser.Math.Between(0, width), Phaser.Math.Between(-20, height * 0.4));

      this.tweens.add({
        targets: petal,
        y: height + 30,
        x: `+=${Phaser.Math.Between(50, 150)}`,
        angle: { from: -30, to: 45 },
        duration: Phaser.Math.Between(5000, 9000),
        repeat: -1,
        ease: 'Linear',
        delay: Phaser.Math.Between(0, 4000),
      });

      this.particles.push(petal);
    }

    // =========================================================================
    // 3. THẺ HOÀNG KIM CUNG ĐÌNH TRUNG TÂM (GLASSMORPHIC SHRINE CARD)
    // =========================================================================
    const cardW = Math.min(460, width * 0.9);
    const cardH = 260;
    const cardX = width / 2;
    const cardY = height / 2;

    this.loadingCardContainer = this.add.container(cardX, cardY);

    // Quầng sáng hào quang tỏa ra từ phía sau thẻ
    const auraHalo = this.add.graphics();
    auraHalo.fillStyle(0xf59e0b, 0.22);
    auraHalo.fillCircle(0, 0, 180);
    this.tweens.add({
      targets: auraHalo,
      scaleX: { from: 0.9, to: 1.15 },
      scaleY: { from: 0.9, to: 1.15 },
      alpha: { from: 0.15, to: 0.35 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Mặt thẻ Kính Thủy Tinh Huyền Ảo (Dark Frosted Obsidian Glass)
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x0a0e17, 0.82);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 24);

    // Viền kép Kim Sa Hoàng Đế
    cardBg.lineStyle(2, 0xd4af37, 0.95);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 24);

    cardBg.lineStyle(1, 0xfef08a, 0.35);
    cardBg.strokeRoundedRect(-cardW / 2 + 5, -cardH / 2 + 5, cardW - 10, cardH - 10, 20);

    // Hoa văn 4 góc Cung Đình Á Đông
    const cornerTL = this.add.text(-cardW / 2 + 14, -cardH / 2 + 10, '❖', { fontSize: '15px', color: '#fbbf24' });
    const cornerTR = this.add.text(cardW / 2 - 24, -cardH / 2 + 10, '❖', { fontSize: '15px', color: '#fbbf24' });
    const cornerBL = this.add.text(-cardW / 2 + 14, cardH / 2 - 26, '❖', { fontSize: '15px', color: '#fbbf24' });
    const cornerBR = this.add.text(cardW / 2 - 24, cardH / 2 - 26, '❖', { fontSize: '15px', color: '#fbbf24' });

    // Biểu tượng Hoa Sen Thần Linh trên đỉnh
    const crestCircle = this.add.graphics();
    crestCircle.fillStyle(0x78350f, 0.85);
    crestCircle.lineStyle(1.5, 0xfde047, 0.9);
    crestCircle.fillCircle(0, -cardH / 2 + 28, 18);
    crestCircle.strokeCircle(0, -cardH / 2 + 28, 18);

    const crestIcon = this.add.text(0, -cardH / 2 + 28, '🌸', { fontSize: '17px' }).setOrigin(0.5);

    // Tiêu đề thương hiệu AVORA FARM
    const titleText = this.add
      .text(0, -32, 'AVORA FARM', {
        fontFamily: 'Georgia, serif, "Cinzel"',
        fontSize: width < 400 ? '26px' : '30px',
        color: '#fef9c3',
        fontStyle: 'bold',
        stroke: '#78350f',
        strokeThickness: 2,
        shadow: {
          offsetX: 0,
          offsetY: 3,
          color: '#000000',
          blur: 10,
          fill: true,
        },
      })
      .setOrigin(0.5);

    // Dòng giới thiệu phong cách Tiên Hiệp Á Đông
    const subtitleBadge = this.add
      .text(0, -2, '✦ KHU VƯỜN THẦN TIÊN ✦', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        color: '#34d399',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Thông điệp trạng thái sinh động (Tips)
    this.tipText = this.add
      .text(0, 30, '🌸 Đang đánh thức Cây Thần AVORA ngàn năm...', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5);

    // =========================================================================
    // 4. THANH TIẾN TRÌNH MA THUẬT SIÊU LUNG LINH (DELUXE PROGRESS BAR)
    // =========================================================================
    const barW = Math.min(340, cardW * 0.85);
    const barH = 14;
    const barX = -barW / 2;
    const barY = 56;

    // Rãnh trượt rực rỡ
    const progressTrack = this.add.graphics();
    // Viền ngoài phát sáng
    progressTrack.lineStyle(1.5, 0xd4af37, 0.95);
    progressTrack.strokeRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 8);
    // Nền rãnh trượt
    progressTrack.fillStyle(0x0f172a, 0.95);
    progressTrack.fillRoundedRect(barX, barY, barW, barH, 7);

    // Thanh nạp ánh sáng (sẽ vẽ động theo giá trị % tải)
    this.progressGlow = this.add.graphics();
    this.progressBar = this.add.graphics();
    this.progressSparkle = this.add.graphics();

    // Nhãn phần trăm số lớn rực rỡ bên dưới thanh
    this.percentText = this.add
      .text(barW / 2, barY + 24, '0%', {
        fontFamily: 'monospace, "Courier New", sans-serif',
        fontSize: '13px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);

    // Nhãn số lượng tài nguyên
    this.assetCountText = this.add
      .text(-barW / 2, barY + 24, 'Đang chuẩn bị...', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#94a3b8',
      })
      .setOrigin(0, 0.5);

    // Gom toàn bộ vào Container trung tâm
    this.loadingCardContainer.add([
      auraHalo,
      cardBg,
      cornerTL,
      cornerTR,
      cornerBL,
      cornerBR,
      crestCircle,
      crestIcon,
      titleText,
      subtitleBadge,
      this.tipText,
      progressTrack,
      this.progressGlow,
      this.progressBar,
      this.progressSparkle,
      this.percentText,
      this.assetCountText,
    ]);

    // =========================================================================
    // 5. XỬ LÝ SỰ KIỆN TẢI TÀI NGUYÊN THỰC TẾ
    // =========================================================================
    this.load.on('progress', (value: number) => {
      this.targetProgress = value;
      this.updateLoadingDisplay(value, barX, barY, barW, barH);
      farmEventBus.emit('LOAD_PROGRESS', {
        value,
        percent: Math.round(value * 100),
        loaded: this.loadedAssetsCount,
        total: this.totalAssetsCount,
      });
    });

    this.load.on('filecomplete', (key: string) => {
      this.loadedAssetsCount++;
      const current = Math.min(this.loadedAssetsCount, this.totalAssetsCount);
      this.assetCountText.setText(`Đang tải (${current}/${this.totalAssetsCount})`);

      try {
        if (this.textures.exists(key)) {
          const tex = this.textures.get(key);
          tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
      } catch {}

      farmEventBus.emit('LOAD_PROGRESS', {
        value: this.targetProgress,
        percent: Math.round(this.targetProgress * 100),
        loaded: current,
        total: this.totalAssetsCount,
      });
    });

    this.load.on('loaderror', (fileObj: any) => {
      console.warn(`⚠️ Farm asset fallback: ${fileObj.key} (${fileObj.src})`);
      const entry = FULL_FARM_ASSET_MANIFEST.find((e) => e.key === fileObj.key);
      if (entry && entry.fallbackPath && fileObj.src !== entry.fallbackPath) {
        this.load.image(entry.key, entry.fallbackPath);
      }
    });

    // Nạp toàn bộ 50+ tài nguyên hình ảnh nông trại
    FULL_FARM_ASSET_MANIFEST.forEach((entry) => {
      if (entry.path.endsWith('.svg')) {
        this.load.svg(entry.key, entry.path, { width: 64, height: 64 });
      } else {
        this.load.image(entry.key, entry.path);
      }
    });
  }

  private updateLoadingDisplay(value: number, barX: number, barY: number, barW: number, barH: number) {
    const percent = Math.round(value * 100);
    this.percentText.setText(`${percent}%`);

    const currentW = Math.max(0, barW * value);

    // Vẽ thanh nạp xanh ngọc bích - vàng hoàng kim đa sắc
    this.progressBar.clear();
    if (currentW > 4) {
      // Glow nền
      this.progressGlow.clear();
      this.progressGlow.fillStyle(0x34d399, 0.25);
      this.progressGlow.fillRoundedRect(barX - 1, barY - 1, currentW + 2, barH + 2, 7);

      // Thân thanh tiến trình chính
      this.progressBar.fillStyle(0x10b981, 1);
      this.progressBar.fillRoundedRect(barX, barY, currentW, barH, 6);

      // Lớp highlight bóng loáng ở nửa trên của thanh
      this.progressBar.fillStyle(0xa7f3d0, 0.45);
      this.progressBar.fillRoundedRect(barX + 1, barY + 1, Math.max(0, currentW - 2), barH / 2 - 1, 4);

      // Đầu thanh tiến trình: Ngôi sao lấp lánh di chuyển theo %
      this.progressSparkle.clear();
      const sparkleX = barX + currentW;
      const sparkleY = barY + barH / 2;

      this.progressSparkle.fillStyle(0xffffff, 1);
      this.progressSparkle.fillCircle(sparkleX, sparkleY, 4);

      this.progressSparkle.lineStyle(1.5, 0xfde047, 0.9);
      this.progressSparkle.strokeCircle(sparkleX, sparkleY, 6);
    }

    // Thay đổi thông điệp gợi ý sống động theo tiến độ
    if (percent < 25) {
      this.tipText.setText('🌸 Đang đánh thức Cây Thần AVORA ngàn năm...');
    } else if (percent < 50) {
      this.tipText.setText('🌱 Đang gieo trồng những mầm thảo mộc may mắn...');
    } else if (percent < 75) {
      this.tipText.setText('💧 Đang kết tinh sương sớm thần tiên tưới đất...');
    } else if (percent < 95) {
      this.tipText.setText('🧧 Đang treo phong bao Lì Xì Đại Cát lên cành...');
    } else {
      this.tipText.setText('✨ Tiên cảnh đã sẵn sàng! Đang mở cổng bước vào...');
    }
  }

  create() {
    console.log('✅ All 50+ Farm Assets Preloaded Successfully.');

    // Hoàn tất tiến trình 100%
    this.percentText.setText('100%');
    this.tipText.setText('✨ Đón chào bạn đến với AVORA Farm!');
    farmEventBus.emit('PRELOAD_COMPLETE');

    // Hiệu ứng mờ dần nhẹ nhàng (Smooth Transition) trước khi chuyển vào trò chơi
    this.tweens.add({
      targets: [this.loadingCardContainer, ...this.particles],
      alpha: 0,
      duration: 450,
      ease: 'Power2',
      onComplete: () => {
        // Khởi động đồng thời FarmScene và EffectsScene
        this.scene.start('FarmScene');
        this.scene.launch('EffectsScene');
      },
    });
  }
}
