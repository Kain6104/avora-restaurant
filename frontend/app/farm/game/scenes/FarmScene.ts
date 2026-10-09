import * as Phaser from 'phaser';
import { ISOMETRIC_CONFIG, ENVIRONMENT_PROPS_CONFIG } from '../config/FarmMapConfig';
import { FarmWorldLayoutConfig, validateWorldPointInSafeArea } from '../config/FarmWorldLayoutConfig';
import { FARM_ASSET_KEYS } from '../assets/FarmAssetRegistry';
import { getCropTextureKey, getMutationTextureKey } from '../assets/FarmAssetRegistry';
import { farmEventBus } from '../services/farmEventBus';
import { CameraControls } from '../systems/CameraControls';
import { IsometricGrid } from '../systems/IsometricGrid';
import { cropScaleResolver } from '../systems/CropScaleResolver';
import { qualityManager } from '../systems/QualityManager';
import { getFarmUIPreferences } from '../../utils/farmPreferences';

interface PlotEntity {
  plotIndex: number;
  plotContainer: Phaser.GameObjects.Container;
  tileSprite: Phaser.GameObjects.Image;
  shadowSprite?: Phaser.GameObjects.Ellipse;
  plantContainer?: Phaser.GameObjects.Container;
  plantBaseSprite?: Phaser.GameObjects.Image;
  plantTopContainer?: Phaser.GameObjects.Container;
  plantTopSprite?: Phaser.GameObjects.Image;
  cropSprite?: Phaser.GameObjects.Image;
  readyGlow?: Phaser.GameObjects.Image;
  harvestBadge?: Phaser.GameObjects.Image;
  sparkleContainer?: Phaser.GameObjects.Container;
  divineHalo?: Phaser.GameObjects.Graphics;
  data: any;
  currentRenderedStage?: number;
  swayTween?: Phaser.Tweens.Tween;
  isLayoutHidden?: boolean;
}

const TREE_ENVELOPE_ANCHORS = [
  { dx: -45, dy: -275, scale: 0.28, swayAngle: 3.0, duration: 2800, delay: 0 },
  { dx: 50, dy: -270, scale: 0.27, swayAngle: -2.8, duration: 3100, delay: 350 },
  { dx: -105, dy: -220, scale: 0.29, swayAngle: 3.2, duration: 2600, delay: 700 },
  { dx: 110, dy: -215, scale: 0.28, swayAngle: -3.0, duration: 3300, delay: 200 },
  { dx: -65, dy: -165, scale: 0.27, swayAngle: 2.4, duration: 2900, delay: 500 },
  { dx: 70, dy: -160, scale: 0.28, swayAngle: -2.6, duration: 3000, delay: 900 },
  { dx: 5, dy: -305, scale: 0.26, swayAngle: 2.0, duration: 3400, delay: 1100 },
  { dx: -125, dy: -180, scale: 0.28, swayAngle: -3.4, duration: 2700, delay: 600 },
];

export class FarmScene extends Phaser.Scene {
  private grid!: IsometricGrid;
  public cameraControls!: CameraControls;
  private plotItems: Map<number, PlotEntity> = new Map();
  private avoraTreeSprite?: Phaser.GameObjects.Image;
  private treeContainer?: Phaser.GameObjects.Container;
  private treeShadow?: Phaser.GameObjects.Graphics;
  private canopyContainer?: Phaser.GameObjects.Container;
  private ghostCropSprite: Phaser.GameObjects.Image | null = null;
  public isWorldInputBlocked: boolean = false;
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private visualScaleDebugGraphics?: Phaser.GameObjects.Graphics;
  private visualScaleDebugTexts: Phaser.GameObjects.Text[] = [];

  // AVORA Global Garden Layout State
  public isEditorMode: boolean = false;
  public selectedGardenObjectKey: string | null = null;
  public currentLayout: any = null;
  private gardenDecorationsMap: Map<string, {
    objData: any;
    container: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
    sprite?: Phaser.GameObjects.Image;
    baseSprite?: Phaser.GameObjects.Image;
    topContainer?: Phaser.GameObjects.Container;
    topSprite?: Phaser.GameObjects.Image;
    tween?: Phaser.Tweens.Tween;
  }> = new Map();
  private editorGizmoGraphics?: Phaser.GameObjects.Graphics;
  private editorGizmoHandles: Phaser.GameObjects.Rectangle[] = [];
  public isGizmoAspectLocked: boolean = true;
  private editorSnapLineGraphics?: Phaser.GameObjects.Graphics;

  public isVisitMode: boolean = false;
  public visitingData: any = null;
  private visitTheftBadges: Map<number, Phaser.GameObjects.Container> = new Map();

  private luckyEnvelopeItems: {
    sprite: Phaser.GameObjects.Image;
    glow?: Phaser.GameObjects.Graphics;
    badge?: Phaser.GameObjects.Container;
  }[] = [];
  private luckyEnvelopeTicketCount: number = 0;
  private maxVisibleEnvelopes: number = 8;

  // Ambient Island Night Glows (Làm sáng đảo ban đêm phong cách AAA)
  private nightMoonlightGlow: Phaser.GameObjects.Ellipse | null = null;
  private nightWarmLanternGlow: Phaser.GameObjects.Ellipse | null = null;

  constructor() {
    super({ key: 'FarmScene' });
  }

  create() {
    // Khởi tạo hệ thống Lưới Isometric và Điều khiển Camera
    this.grid = new IsometricGrid();
    this.cameraControls = new CameraControls(this);

    // 1. Dựng khung cảnh Môi trường Đảo Nổi & Bầu Trời Ban Ngày
    this.buildWorldEnvironment();

    // 2. Dựng 25 Ô đất nông trại (5x5 Isometric Grid)
    this.buildFarmPlots();

    // 3. Dựng Cây Thần AVORA (Hero Object) và Đạo cụ vườn Nhật
    this.buildEnvironmentProps();

    // 4. Lắng nghe các sự kiện đồng bộ từ React
    this.setupEventListeners();

    // 5. Căn giữa Camera ban đầu vào hòn đảo (theo cấu hình tâm mới)
    this.cameraControls.centerOnWorld(
      FarmWorldLayoutConfig.CAMERA.DEFAULT_CENTER_X,
      FarmWorldLayoutConfig.CAMERA.DEFAULT_CENTER_Y,
      0
    );

    // Lưu tham chiếu scene toàn cục phục vụ React sync tọa độ & Cung cấp hàm đo đạc kích thước thực tế
    if (typeof window !== 'undefined') {
      (window as any).__AVORA_FARM_SCENE = this;
      (window as any).__AVORA_FARM_SCENE_READY = true;
      (window as any).getFarmMetrics = () => {
        const plot0 = this.plotItems.get(0);
        const plot1 = this.plotItems.get(1);
        const plot4 = this.plotItems.get(4);
        const plot20 = this.plotItems.get(20);
        const plot24 = this.plotItems.get(24);
        return {
          plotScale: FarmWorldLayoutConfig.PLOT_SCALE,
          cropScale: FarmWorldLayoutConfig.CROP_SCALE,
          targetPlotDisplayWidth: FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH,
          targetPlotDisplayHeight: FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_HEIGHT,
          plotScaleRatioVsBaseline: (FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH / 132).toFixed(2) + 'x (200.0%)',
          cropScaleRatioVsBaseline: ((FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH * 0.86) / 113.52).toFixed(2) + 'x (200.0%)',
          treeScale: FarmWorldLayoutConfig.AVORA_TREE_SCALE,
          treeScaleRatioVsBaseline: (FarmWorldLayoutConfig.AVORA_TREE_SCALE / 0.38).toFixed(2) + 'x (140.0%)',
          tileStepWidth: FarmWorldLayoutConfig.TILE_WIDTH,
          tileStepHeight: FarmWorldLayoutConfig.TILE_HEIGHT,
          gapBetweenPlotsPx: FarmWorldLayoutConfig.TILE_WIDTH - FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH,
          gapRatio: ((FarmWorldLayoutConfig.TILE_WIDTH - FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH) / FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH * 100).toFixed(2) + '%',
          plot0_Top: plot0 ? { x: plot0.tileSprite.x, y: plot0.tileSprite.y, width: plot0.tileSprite.displayWidth, height: plot0.tileSprite.displayHeight } : null,
          plot1_SampleCrop: plot1 ? { cropWidth: plot1.cropSprite?.displayWidth, cropHeight: plot1.cropSprite?.displayHeight } : null,
          plot4_Right: plot4 ? { x: plot4.tileSprite.x, y: plot4.tileSprite.y } : null,
          plot20_Left: plot20 ? { x: plot20.tileSprite.x, y: plot20.tileSprite.y } : null,
          plot24_Bottom: plot24 ? { x: plot24.tileSprite.x, y: plot24.tileSprite.y } : null,
          treeContainerPos: this.treeContainer ? { x: this.treeContainer.x, y: this.treeContainer.y } : null,
        };
      };
      console.log('[FarmScene] 🌿 Farm Layout Metrics (200% Plots, 200% Crops, 140% Tree):', (window as any).getFarmMetrics());
    }

    farmEventBus.emit('SCENE_READY');
  }

  /**
   * Chuyển đổi tọa độ Thế giới (worldX, worldY) sang tọa độ Màn hình Viewport
   */
  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const cam = this.cameras?.main;
    if (!cam) {
      return {
        x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
        y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
      };
    }
    const midX = (cam.scrollX ?? 0) + cam.width / 2;
    const midY = (cam.scrollY ?? 0) + cam.height / 2;
    const zoom = cam.zoom || 1;
    const left = midX - cam.width / (2 * zoom);
    const top = midY - cam.height / (2 * zoom);
    return {
      x: (worldX - left) * zoom,
      y: (worldY - top) * zoom,
    };
  }

  /**
   * Chuyển đổi tọa độ Màn hình Viewport sang tọa độ Thế giới (worldX, worldY)
   */
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const cam = this.cameras?.main;
    if (!cam) {
      return { x: screenX, y: screenY };
    }
    const midX = (cam.scrollX ?? 0) + cam.width / 2;
    const midY = (cam.scrollY ?? 0) + cam.height / 2;
    const zoom = cam.zoom || 1;
    const left = midX - cam.width / (2 * zoom);
    const top = midY - cam.height / (2 * zoom);
    return {
      x: left + screenX / zoom,
      y: top + screenY / zoom,
    };
  }

  /**
   * Tìm ô đất gần nhất dưới con trỏ/ngón tay (hỗ trợ Drag & Drop gieo hạt cực nhanh)
   */
  public getPlotAtScreenPos(screenX: number, screenY: number): number | null {
    const worldPos = this.screenToWorld(screenX, screenY);
    let closestPlotIndex: number | null = null;
    let minDistanceSq = Infinity;
    const maxHitRadius = FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH * 0.48; // Chuẩn hóa theo bán kính hiển thị ô đất mới (88px)

    for (const [plotIndex, item] of this.plotItems.entries()) {
      const dx = worldPos.x - item.plotContainer.x;
      const dy = (worldPos.y - item.plotContainer.y) * 2; // Tỷ lệ trục isometric 2:1
      const distSq = dx * dx + dy * dy;
      if (distSq < maxHitRadius * maxHitRadius && distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestPlotIndex = plotIndex;
      }
    }
    return closestPlotIndex;
  }

  /**
   * Hiệu ứng vòi nước tưới mát rượi lên ô đất
   */
  public playWaterSplashAnim(plotIndex: number) {
    const item = this.plotItems.get(plotIndex);
    if (!item) return;

    this.tweens.add({
      targets: item.tileSprite,
      y: -5,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    const splash = this.add.graphics();
    const depth = this.grid.calculateDepth(item.plotContainer.y, 10);
    splash.setDepth(depth);
    splash.setPosition(item.plotContainer.x, item.plotContainer.y);

    splash.lineStyle(2.5, 0x38bdf8, 0.9);
    splash.strokeEllipse(0, 0, 26, 13);
    splash.fillStyle(0x0284c7, 0.4);
    splash.fillEllipse(0, 0, 26, 13);

    this.tweens.add({
      targets: splash,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => splash.destroy(),
    });
  }

  /**
   * Xây dựng Địa hình Hòn đảo Nổi 2.5D (Floating Island) & Thác Nước Hoạt Họa
   */
  private buildWorldEnvironment() {
    const originX = FarmWorldLayoutConfig.GRID_ORIGIN_X;
    const originY = FarmWorldLayoutConfig.GRID_ORIGIN_Y;

    // Layer 0 (Background): Để trống hoàn toàn, Phaser Canvas trong suốt 100%
    // để lộ Video Loop toàn màn hình (avora-farm-day-loop.mp4) bên dưới HTML!

    // Layer 1: 3D Rocky Island Cliff Base with Waterfall & Roots (Đặt sâu ở z: -2000 để không bao giờ che ô đất)
    this.add
      .image(10, 310, FARM_ASSET_KEYS.TERRAIN.ISLAND_CLIFF)
      .setOrigin(0.5, 0.5)
      .setScale(1.22)
      .setDepth(-2000);

    // Layer 1.1: Ambient Island Moonlight & Warm Lantern Glow (Làm sáng rực rỡ hòn đảo ban đêm)
    this.nightMoonlightGlow = this.add
      .ellipse(10, 240, 720, 460, 0x7dd3fc, 0)
      .setDepth(-1992)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.nightWarmLanternGlow = this.add
      .ellipse(-40, 210, 380, 260, 0xfef08a, 0)
      .setDepth(-1991)
      .setBlendMode(Phaser.BlendModes.ADD);

    const initialPrefs = getFarmUIPreferences();
    if (initialPrefs.theme === 'NIGHT') {
      this.nightMoonlightGlow.setAlpha(0.08);
      this.nightWarmLanternGlow.setAlpha(0.05);
    }

    // Layer 1.5: THÁC NƯỚC SỐNG ĐỘNG (Bên phải hòn đảo)
    const wf = FarmWorldLayoutConfig.WATERFALL;
    for (let i = 0; i < 4; i++) {
      const streamX = wf.originX + i * 8;
      const streak = this.add
        .rectangle(streamX, wf.streamTopY, 3.5, 52, 0xe0f7fa, 0.65)
        .setDepth(-1998);
      this.tweens.add({
        targets: streak,
        alpha: { from: 0.35, to: 0.9 },
        scaleY: { from: 0.8, to: 1.25 },
        y: '+=6',
        duration: 320 + i * 70,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Vòng sóng nước lan tỏa trên hồ chân thác
    const createRipple = () => {
      const ripple = this.add
        .ellipse(wf.originX + 12, wf.pondY, 24, 12, 0xffffff, 0)
        .setStrokeStyle(1.5, 0xbae6fd, 0.75)
        .setDepth(-1995);
      this.tweens.add({
        targets: ripple,
        scaleX: 2.8,
        scaleY: 2.8,
        alpha: 0,
        duration: 2200,
        ease: 'Sine.easeOut',
        onComplete: () => ripple.destroy(),
      });
    };
    this.time.addEvent({ delay: 1100, callback: createRipple, loop: true });

    // Hạt sương mù bốc lên nhẹ nhàng từ mặt hồ
    const createMist = () => {
      const mist = this.add
        .circle(
          wf.originX + 12 + (Math.random() * 26 - 13),
          wf.pondY - 5,
          5 + Math.random() * 4,
          0xffffff,
          0.22
        )
        .setDepth(-1994);
      this.tweens.add({
        targets: mist,
        y: mist.y - 40 - Math.random() * 15,
        x: mist.x + (Math.random() * 16 - 8),
        alpha: 0,
        scale: 1.8,
        duration: 2400,
        ease: 'Sine.easeOut',
        onComplete: () => mist.destroy(),
      });
    };
    this.time.addEvent({ delay: 650, callback: createMist, loop: true });

    // Layer 2: Stone Path dẫn từ cổng Torii trên thảm cỏ
    for (const coord of FarmWorldLayoutConfig.STONE_PATH_COORDS) {
      const { x, y } = this.grid.gridToWorld(coord.r, coord.c, originX, originY);
      validateWorldPointInSafeArea(x, y, 'Stone Path');
      this.add
        .image(x, y, FARM_ASSET_KEYS.TERRAIN.STONE_PATH)
        .setOrigin(0.5, 0.5)
        .setScale(0.85)
        .setDepth(this.grid.calculateDepth(y, -40));
    }
  }

  /**
   * Áp dụng kích thước render chuẩn hóa, scale và hitbox kim cương cho tile sprite của ô đất
   * Đảm bảo mọi trạng thái (LOCKED, EMPTY, WATERED, READY) đều hiển thị chính xác
   * TARGET_PLOT_DISPLAY_WIDTH (88px) dù texture gốc là 1564x1006 hay 140x90.
   */
  private applyPlotTileMetrics(tileSprite: Phaser.GameObjects.Image, textureKey: string) {
    tileSprite.setTexture(textureKey);

    const texture = this.textures.get(textureKey);
    const sourceImage = texture?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    const rawW = sourceImage && sourceImage.width > 0 ? sourceImage.width : 140;
    const rawH = sourceImage && sourceImage.height > 0 ? sourceImage.height : 90;

    // Tính tỷ lệ scale để ô đất luôn hiển thị đúng TARGET_PLOT_DISPLAY_WIDTH (264px)
    const targetDisplayW = FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH;
    const scale = targetDisplayW / rawW;
    tileSprite.setScale(scale);
    tileSprite.setOrigin(0.5, 0.45);
    tileSprite.setVisible(true);
    tileSprite.setAlpha(1.0);
    tileSprite.setDepth(10);

    // Hitbox đa giác kim cương dựa trên kích thước thực của texture nguồn (Phaser tự scale theo sprite)
    const poly = new Phaser.Geom.Polygon([
      rawW * 0.5, rawH * 0.05,
      rawW * 0.96, rawH * 0.48,
      rawW * 0.5, rawH * 0.92,
      rawW * 0.04, rawH * 0.48,
    ]);
    tileSprite.setInteractive(poly, Phaser.Geom.Polygon.Contains);
    if (tileSprite.input) {
      tileSprite.input.cursor = 'pointer';
    }
  }

  /**
   * Xây dựng 25 Ô đất nông trại (5x5 Isometric Grid)
   */
  private buildFarmPlots() {
    const originX = FarmWorldLayoutConfig.GRID_ORIGIN_X;
    const originY = FarmWorldLayoutConfig.GRID_ORIGIN_Y;

    for (let row = 0; row < ISOMETRIC_CONFIG.GRID_SIZE; row++) {
      for (let col = 0; col < ISOMETRIC_CONFIG.GRID_SIZE; col++) {
        const plotIndex = row * ISOMETRIC_CONFIG.GRID_SIZE + col;
        const { x, y } = this.grid.gridToWorld(row, col, originX, originY);
        validateWorldPointInSafeArea(x, y, `Plot #${plotIndex}`);
        const depth = this.grid.calculateDepth(y, 0);

        const isDefaultUnlocked = plotIndex < 6;
        const tileKey = isDefaultUnlocked
          ? FARM_ASSET_KEYS.PLOTS.EMPTY
          : FARM_ASSET_KEYS.PLOTS.LOCKED_WILD;

        // 1. Master Container FarmPlotNode: gom toàn bộ layer cục bộ của ô đất
        const pw = FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH;
        const ph = FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_HEIGHT;
        const plotContainer = this.add.container(x, y).setDepth(depth);
        plotContainer.setSize(pw, ph);

        // 2. Layer 0: Contact shadow ô đất
        const shadow = this.add
          .ellipse(0, 4, 52, 24, 0x1a2e1c, 0.3)
          .setDepth(0)
          .setVisible(false);
        plotContainer.add(shadow);

        // 3. Layer 10: Tile nền đất hữu cơ
        const tileSprite = this.add
          .image(0, 0, tileKey)
          .setDepth(10);

        this.applyPlotTileMetrics(tileSprite, tileKey);
        plotContainer.add(tileSprite);

        plotContainer.sort('depth');

        // Hover & Click Tweens với cơ chế kiểm tra Input Blocking
        tileSprite.on('pointerover', () => {
          if (this.isWorldInputBlocked) return;
          tileSprite.setTint(0xfef08a);
        });

        tileSprite.on('pointerout', () => {
          tileSprite.clearTint();
        });

        this.bindSafeTap(tileSprite, () => {
          this.handlePlotClick(plotIndex);
        });

        this.plotItems.set(plotIndex, {
          plotIndex,
          plotContainer,
          tileSprite,
          shadowSprite: shadow,
          data: {
            plotIndex,
            status: isDefaultUnlocked ? 'EMPTY' : 'LOCKED',
            unlockLevel: Math.floor(plotIndex / 3) + 1,
          },
        });
      }
    }

    // Kiểm tra cờ FARM_DEBUG_INTERACTION từ window hoặc localStorage
    const isDebug =
      typeof window !== 'undefined' &&
      ((window as any).FARM_DEBUG_INTERACTION === true ||
        localStorage.getItem('FARM_DEBUG_INTERACTION') === 'true');
    if (isDebug) {
      this.renderDebugInteractionOverlay();
    }

    const isVisualScaleDebug =
      typeof window !== 'undefined' &&
      ((window as any).FARM_DEBUG_VISUAL_SCALE === true ||
        localStorage.getItem('FARM_DEBUG_VISUAL_SCALE') === 'true');
    if (isVisualScaleDebug) {
      this.renderDebugVisualScaleOverlay();
    }
  }

  /**
   * Hiển thị Hitbox, Trạng thái & Tọa độ khi bật chế độ FARM_DEBUG_INTERACTION hoặc FARM_DEBUG_LAYOUT
   */
  private renderDebugInteractionOverlay() {
    if (!this.debugGraphics) {
      this.debugGraphics = this.add.graphics().setDepth(99999);
    }
    this.debugGraphics.clear();

    const originX = FarmWorldLayoutConfig.GRID_ORIGIN_X;
    const originY = FarmWorldLayoutConfig.GRID_ORIGIN_Y;

    // 1. Vẽ ranh giới Safe Playable Area (màu Cyan lấp lánh)
    const safeArea = FarmWorldLayoutConfig.PLAYABLE_SAFE_AREA;
    this.debugGraphics.lineStyle(2, 0x06b6d4, 0.9);
    this.debugGraphics.strokeRect(
      safeArea.minX,
      safeArea.minY,
      safeArea.maxX - safeArea.minX,
      safeArea.maxY - safeArea.minY
    );

    // 2. Vẽ đường giới hạn Cliff Exclusion Zone (màu Đỏ cảnh báo)
    const cliffEx = FarmWorldLayoutConfig.CLIFF_EXCLUSION;
    this.debugGraphics.lineStyle(2, 0xef4444, 0.95);
    this.debugGraphics.beginPath();
    this.debugGraphics.moveTo(safeArea.minX, cliffEx.cliffBottomEdgeY);
    this.debugGraphics.lineTo(safeArea.maxX, cliffEx.cliffBottomEdgeY);
    this.debugGraphics.moveTo(cliffEx.waterfallLeftEdgeX, safeArea.minY);
    this.debugGraphics.lineTo(cliffEx.waterfallLeftEdgeX, safeArea.maxY);
    this.debugGraphics.strokePath();

    for (let row = 0; row < ISOMETRIC_CONFIG.GRID_SIZE; row++) {
      for (let col = 0; col < ISOMETRIC_CONFIG.GRID_SIZE; col++) {
        const plotIndex = row * ISOMETRIC_CONFIG.GRID_SIZE + col;
        const { x, y } = this.grid.gridToWorld(row, col, originX, originY);
        const item = this.plotItems.get(plotIndex);
        const isLocked = item?.data?.status === 'LOCKED';

        const hw = FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH / 2;
        const hh = FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_HEIGHT / 2;
        this.debugGraphics.lineStyle(1.5, isLocked ? 0xef4444 : 0x10b981, 0.85);
        this.debugGraphics.beginPath();
        this.debugGraphics.moveTo(x, y - hh * 0.85);
        this.debugGraphics.lineTo(x + hw, y);
        this.debugGraphics.lineTo(x, y + hh * 0.85);
        this.debugGraphics.lineTo(x - hw, y);
        this.debugGraphics.closePath();
        this.debugGraphics.strokePath();

        this.add
          .text(x, y, `#${plotIndex}\n(${row},${col})`, {
            fontSize: '9px',
            color: isLocked ? '#fca5a5' : '#86efac',
            align: 'center',
            backgroundColor: '#000000aa',
          })
          .setOrigin(0.5)
          .setDepth(100000);
      }
    }
  }

  /**
   * Hiển thị Visible Bounds, Foot Anchor & Tỷ lệ Scale khi bật FARM_DEBUG_VISUAL_SCALE
   */
  private renderDebugVisualScaleOverlay() {
    if (!this.visualScaleDebugGraphics) {
      this.visualScaleDebugGraphics = this.add.graphics().setDepth(100002);
    }
    this.visualScaleDebugGraphics.clear();
    this.visualScaleDebugTexts.forEach((t) => t.destroy());
    this.visualScaleDebugTexts = [];

    this.plotItems.forEach((item) => {
      const cropInstance = item.data?.cropInstance;
      if (!cropInstance || !cropInstance.crop || !item.cropSprite || !item.cropSprite.visible) return;

      const crop = cropInstance.crop;
      const stage = item.data?.growthState?.stage ?? cropInstance.calculatedStage ?? 0;
      const cropTextureKey = item.cropSprite.texture.key;
      const resolution = cropScaleResolver.resolveCropVisual(
        crop.code,
        stage,
        item.plotContainer.x,
        item.plotContainer.y,
        this.textures.get(cropTextureKey)
      );

      // 1. Chân cây (Foot Anchor) màu đỏ
      this.visualScaleDebugGraphics!.fillStyle(0xef4444, 1.0);
      this.visualScaleDebugGraphics!.fillCircle(resolution.anchorX, resolution.anchorY, 3.5);

      // 2. Vùng hình ảnh thực (Visible Plant Bounds) màu xanh lá
      const rectLeft = resolution.anchorX - (resolution.originX * resolution.displayWidth) + (resolution.hitArea.x * resolution.scale);
      const rectTop = resolution.anchorY - (resolution.originY * resolution.displayHeight) + (resolution.hitArea.y * resolution.scale);
      this.visualScaleDebugGraphics!.lineStyle(1.5, 0x22c55e, 0.95);
      this.visualScaleDebugGraphics!.strokeRect(
        rectLeft,
        rectTop,
        resolution.renderedVisibleWidth,
        resolution.renderedVisibleHeight
      );

      // 3. Nhãn thông số
      const t = this.add
        .text(
          resolution.anchorX,
          resolution.anchorY + 14,
          `${crop.code} S${stage}\n${resolution.debugInfo.sourceSize}\n${resolution.debugInfo.renderedVisibleSize} (${Math.round(resolution.debugInfo.heightRatio * 100)}%)\nScale:${resolution.debugInfo.baseScale}`,
          {
            fontSize: '8px',
            color: '#86efac',
            backgroundColor: '#000000dd',
            align: 'center',
            padding: { x: 3, y: 2 },
          }
        )
        .setOrigin(0.5, 0)
        .setDepth(100003);
      this.visualScaleDebugTexts.push(t);
    });
  }

  /**
   * Xây dựng Cây Thần AVORA và các đạo cụ vườn Nhật
   */
  private buildEnvironmentProps() {
    const originX = FarmWorldLayoutConfig.GRID_ORIGIN_X;
    const originY = FarmWorldLayoutConfig.GRID_ORIGIN_Y;

    for (const prop of FarmWorldLayoutConfig.PROPS_ANCHORS) {
      if (
        prop.key.includes('torii_gate') ||
        prop.key.includes('stone_lantern') ||
        prop.key.includes('wooden_bridge')
      ) {
        continue;
      }
      const { x, y } = (prop.worldX !== undefined && prop.worldY !== undefined)
        ? { x: prop.worldX, y: prop.worldY }
        : this.grid.gridToWorld(
            prop.gridRow ?? 0,
            prop.gridCol ?? 0,
            originX + (prop.offsetX || 0),
            originY + (prop.offsetY || 0),
          );
      validateWorldPointInSafeArea(x, y, `Prop: ${prop.key}`);
      const depth = this.grid.calculateDepth(y, prop.depthOffset || 0);

      const sprite = this.add
        .image(x, y, prop.key)
        .setOrigin(prop.originX ?? 0.5, prop.originY ?? 0.85)
        .setScale(prop.scale ?? 1)
        .setDepth(depth);

      if (prop.key === 'prop_avora_tree') {
        // Hủy sprite tạo trước đó để thay bằng Container
        sprite.destroy();

        // 1. Bóng đổ tiếp xúc mặt đất dưới chậu Cây Thần AVORA (ở tọa độ thế giới)
        const shadow = this.add.graphics();
        shadow.fillStyle(0x1a1205, 0.38);
        shadow.fillEllipse(0, 0, 96 * (prop.scale ?? 0.38), 38 * (prop.scale ?? 0.38));
        shadow.setPosition(x, y + 2);
        shadow.setDepth(depth - 1);
        this.treeShadow = shadow;

        // 2. Container trung tâm chứa Cây Thần (HOÀN TOÀN ĐỨNG YÊN TẠI GỐC, KHÔNG QUAY, KHÔNG LẮC)
        this.treeContainer = this.add.container(x, y);
        this.treeContainer.setDepth(depth);
        this.treeContainer.setScale(prop.scale ?? FarmWorldLayoutConfig.AVORA_TREE_SCALE);

        // HIỂN THỊ TRỌN VẸN 100% CÂY THẦN AVORA TỪ GỐC ĐẾN NGỌN:
        // Không cắt đôi frame, không mask, giữ trọn vẹn 100% bộ rễ cổ thụ, rêu phong, đá cuội và hoa đào rơi
        // Origin (0.5, 0.98) bảo đảm toàn bộ gốc rễ chạm đất vững chãi
        const treeOriginX = prop.originX ?? 0.5;
        const treeOriginY = prop.originY ?? 0.98;

        this.canopyContainer = this.add.container(0, 0);
        this.avoraTreeSprite = this.add
          .image(0, 0, prop.key)
          .setOrigin(treeOriginX, treeOriginY);
        this.canopyContainer.add(this.avoraTreeSprite);
        this.treeContainer.add(this.canopyContainer);

        // Hit Area bao bọc toàn bộ Cây Thần gắn vào treeContainer (cố định, không rung, dễ bấm)
        const treeScaleFactor = (prop.scale ?? 0.38) / 0.38;
        const treeHitArea = new Phaser.Geom.Ellipse(
          0,
          Math.round(-70 * treeScaleFactor),
          Math.round(110 * treeScaleFactor),
          Math.round(160 * treeScaleFactor)
        );
        this.treeContainer.setInteractive(treeHitArea, Phaser.Geom.Ellipse.Contains);
        if (this.treeContainer.input) {
          this.treeContainer.input.cursor = 'pointer';
        }

        this.bindSafeTap(this.treeContainer, () => {
          if (this.isWorldInputBlocked) return;
          if (this.luckyEnvelopeTicketCount > 0) {
            farmEventBus.emit('OPEN_LUCKY_ENVELOPE');
          } else {
            farmEventBus.emit('GAME_TOAST', {
              type: 'info',
              message: '🌸 Cây Thần AVORA',
              subMessage: 'Hoàn thành nhiệm vụ hằng ngày để nhận Bao Lì Xì May Mắn!',
            });
          }
        });

        // HIỆU ỨNG ĐUNG ĐƯA THEO GIÓ:
        // - Gốc cây, rễ cây và chậu bonsai ĐỨNG YÊN TUYỆT ĐỐI (chuyển động 0px)
        // - Góc lắc tự nhiên ±0.8 độ, Sine.easeInOut, không bao giờ bị đứt hay lộ khe hở ở bất kỳ frame nào
        this.tweens.add({
          targets: this.canopyContainer,
          angle: { from: -0.8, to: 0.8 },
          duration: 3800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        // Nếu đã có lượt lì xì may mắn, hiển thị các bao lì xì trên cành cây
        if (this.luckyEnvelopeTicketCount > 0) {
          this.renderLuckyEnvelopes();
        }
      }
    }
  }

  /**
   * Tạo bộ frame liền mạch (Seamless Dual-Layer Plant Slices) đáp ứng nghiêm ngặt:
   * 1. PlantAnimatedTop: kéo dài sâu xuống phần gốc (overlap 8-16px, cây to 24-36px), nằm phía sau, xoay quanh pivot bên trong vùng chồng lấn.
   * 2. PlantStaticBase: nằm phía trước, đứng yên 100%, mép trên có mask chuyển tiếp mềm (feather 4-8px, cây to 10-14px) phủ lên vùng nối.
   * Kết quả: Hai lớp dùng chung kích thước, tỉ lệ, tọa độ chuẩn xác 0px; không bao giờ bị đứt, nứt hay lộ khe hở ở bất kỳ frame nào.
   */
  public getOrCreateSeamlessPlantFrames(
    textureKey: string,
    staticRatio = 0.28,
    customOverlap?: number,
    customFeather?: number
  ): {
    textureKey: string;
    topFrameKey: string;
    baseFrameKey: string;
    baseTextureKey: string;
    baseFrameName?: string;
    rawW: number;
    rawH: number;
    baseTopY: number;
    topH: number;
    baseH: number;
    pivotY_tex: number;
    topOriginY: number;
  } {
    const texture = this.textures.get(textureKey);
    const srcImage = texture?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    const baseFrame = texture?.get('__BASE') || (texture as any)?.frames?.['__BASE'];
    const rawW = Math.max(
      baseFrame?.width || 0,
      (texture as any)?.source?.[0]?.width || 0,
      srcImage ? ((srcImage as any).naturalWidth || srcImage.width || 0) : 0,
      textureKey.includes('tree') ? 1086 : 1024
    );
    const rawH = Math.max(
      baseFrame?.height || 0,
      (texture as any)?.source?.[0]?.height || 0,
      srcImage ? ((srcImage as any).naturalHeight || srcImage.height || 0) : 0,
      textureKey.includes('tree') ? 1448 : 1024
    );

    // Vùng gốc cố định (tính từ đỉnh ảnh xuống)
    const baseTopY = Math.round(rawH * (1 - staticRatio));
    const baseH = Math.max(1, rawH - baseTopY);

    // Vùng chồng lấn (overlap): 12–16px cho cây nhỏ, 36px cho Cây Thần
    const overlapPx = customOverlap ?? (
      rawH > 500
        ? Math.round(Math.min(48, Math.max(24, rawH * 0.025)))
        : Math.round(Math.min(16, Math.max(8, rawH * 0.09)))
    );

    // Độ mờ viền chuyển tiếp (feather mask): 4–8px
    const featherPx = customFeather ?? (
      rawH > 500
        ? Math.round(Math.min(14, Math.max(8, overlapPx * 0.38)))
        : Math.round(Math.min(8, Math.max(4, overlapPx * 0.42)))
    );

    // Chiều cao phần thân trên (topH): từ đỉnh 0 đến (baseTopY + overlapPx)
    const topH = Math.min(rawH, baseTopY + overlapPx);

    // Điểm xoay (Pivot) nằm sâu bên trong vùng chồng lấn
    const pivotY_tex = Math.min(topH - 2, baseTopY + Math.max(featherPx + 1, Math.round(overlapPx * 0.55)));
    const topOriginY = topH > 0 ? pivotY_tex / topH : 1.0;

    const baseFrameKey = `sbase_${staticRatio}_${overlapPx}`;
    const topFrameKey = `stop_${staticRatio}_${overlapPx}`;

    // 1. Luôn đăng ký Texture Frame chuẩn trên WebGL texture gốc (đảm bảo 100% hiển thị không bao giờ mất ảnh)
    if (texture) {
      if (!texture.has(topFrameKey)) {
        texture.add(topFrameKey, 0, 0, 0, rawW, topH);
      }
      if (!texture.has(baseFrameKey)) {
        texture.add(baseFrameKey, 0, 0, baseTopY, rawW, baseH);
      }
    }

    let baseTextureKey = textureKey;
    let baseFrameName: string | undefined = baseFrameKey;

    // 2. Thử nghiệm tạo mask feather mịn trên Canvas 2D nếu có DOM
    const featherKey = `${textureKey}_fbase_${staticRatio}_${overlapPx}_${featherPx}`;
    if (this.textures.exists(featherKey)) {
      baseTextureKey = featherKey;
      baseFrameName = undefined;
    } else if (typeof document !== 'undefined' && srcImage && ((srcImage as any).complete !== false)) {
      try {
        const canvasBase = document.createElement('canvas');
        canvasBase.width = rawW;
        canvasBase.height = baseH;
        const ctxBase = canvasBase.getContext('2d');
        if (ctxBase) {
          ctxBase.drawImage(srcImage, 0, baseTopY, rawW, baseH, 0, 0, rawW, baseH);

          const grad = ctxBase.createLinearGradient(0, 0, 0, featherPx);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 1)');

          ctxBase.globalCompositeOperation = 'destination-in';
          ctxBase.fillStyle = grad;
          ctxBase.fillRect(0, 0, rawW, featherPx);
          ctxBase.fillStyle = 'rgba(0, 0, 0, 1)';
          ctxBase.fillRect(0, featherPx, rawW, Math.max(0, baseH - featherPx));
          ctxBase.globalCompositeOperation = 'source-over';

          const ct = this.textures.addCanvas(featherKey, canvasBase);
          if (ct) {
            ct.refresh(); // Nạp vào GPU WebGL ngay lập tức
            baseTextureKey = featherKey;
            baseFrameName = undefined;
          }
        }
      } catch (err) {
        // Fallback an toàn về WebGL frame gốc
        baseTextureKey = textureKey;
        baseFrameName = baseFrameKey;
      }
    }

    return {
      textureKey,
      topFrameKey,
      baseFrameKey,
      baseTextureKey,
      baseFrameName,
      rawW,
      rawH,
      baseTopY,
      topH,
      baseH,
      pivotY_tex,
      topOriginY,
    };
  }

  /**
   * Helper liên kết Tap / Click an toàn cho cảm ứng Mobile
   * Chỉ kích hoạt Click nếu ngón tay không bị trượt/kéo màn hình (khoảng cách di chuyển < 14px và thời gian chạm < 450ms)
   * Nhờ đó người chơi kéo đảo qua lại tự do mà không bao giờ bị kích hoạt nhầm ô đất!
   */
  public bindSafeTap(
    gameObject: Phaser.GameObjects.GameObject,
    onTap: () => void
  ) {
    let downX = 0;
    let downY = 0;
    let downTime = 0;

    gameObject.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      downX = pointer.x;
      downY = pointer.y;
      downTime = Date.now();
    });

    gameObject.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isWorldInputBlocked) return;
      // Do not trigger plot tap if user was pinching or multi-touching
      if (this.cameraControls?.isPinching || this.input.pointer2?.isDown || this.input.pointer3?.isDown) {
        return;
      }
      const dist = Math.hypot(pointer.x - downX, pointer.y - downY);
      const elapsed = Date.now() - downTime;
      if (dist < 14 && elapsed < 450) {
        onTap();
      }
    });
  }

  /**
   * Xử lý tương tác khi nhấp vào ô đất / cây trồng / huy hiệu
   */
  public handlePlotClick(plotIndex: number) {
    if (this.isWorldInputBlocked) return;

    const item = this.plotItems.get(plotIndex);
    if (!item) return;

    // Bounce tween phản hồi xúc giác
    this.tweens.add({
      targets: item.tileSprite,
      y: -4,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    const screenPos = this.worldToScreen(item.plotContainer.x, item.plotContainer.y);

    // Bắn sự kiện sang React Game UI với đầy đủ tọa độ thế giới & màn hình
    farmEventBus.emit('PLOT_CLICKED', {
      ...item.data,
      plotIndex,
      isVisitMode: this.isVisitMode,
      worldX: item.plotContainer.x,
      worldY: item.plotContainer.y,
      screenX: screenPos.x,
      screenY: screenPos.y,
    });
  }

  /**
   * Đánh dấu các ô đất khả dụng khi người chơi kéo hạt giống (Drag & Drop)
   */
  public highlightPlotsForPlanting(validPlotIndexes: number[]) {
    this.clearPlotHighlights();
    this.plotItems.forEach((item, plotIndex) => {
      if (validPlotIndexes.includes(plotIndex)) {
        item.tileSprite.setTint(0xa7f3d0); // Xanh ngọc dịu dàng báo hiệu ô có thể gieo
      }
    });
  }

  /**
   * Đánh dấu ô đất đang được con trỏ/ngón tay rê qua khi kéo hạt
   */
  public highlightHoverPlot(plotIndex: number, isValid: boolean) {
    const item = this.plotItems.get(plotIndex);
    if (!item) return;

    if (isValid) {
      item.tileSprite.setTint(0x34d399); // Xanh lá ngọc rực rỡ
    } else {
      item.tileSprite.setTint(0xf87171); // Đỏ báo hiệu không thể gieo
    }
  }

  /**
   * Xóa toàn bộ hiệu ứng highlight trên các ô đất
   */
  public clearPlotHighlights() {
    this.plotItems.forEach((item) => {
      item.tileSprite.clearTint();
    });
  }

  /**
   * Dọn sạch toàn bộ các huy hiệu tương tác Ghé Thăm (Trộm / Tưới / Bảo vệ)
   */
  public clearVisitBadges() {
    this.visitTheftBadges.forEach((badge) => {
      badge.destroy();
    });
    this.visitTheftBadges.clear();
  }

  /**
   * Dọn sạch toàn bộ các hiệu ứng lấp lánh và hào quang của một ô đất
   */
  public clearPlotSparkleEffects(item: PlotEntity) {
    if (item.readyGlow) {
      item.readyGlow.setVisible(false);
    }
    if (item.divineHalo) {
      item.divineHalo.destroy();
      item.divineHalo = undefined;
    }
    if (item.sparkleContainer) {
      item.sparkleContainer.destroy();
      item.sparkleContainer = undefined;
    }
  }

  /**
   * Cập nhật Quầng Hào Quang Thần Tiên (Divine Halo) & Bụi Sao Lấp La Lấp Lánh (Twinkle Fairydust)
   */
  public updatePlotSparkleEffects(
    item: PlotEntity,
    _depth: number,
    isRipe: boolean,
    isMutated: boolean,
    localAnchorX: number,
    localAnchorY: number,
    renderedHeight: number
  ) {
    if (!isRipe && !isMutated) {
      this.clearPlotSparkleEffects(item);
      return;
    }

    const centerX = localAnchorX;
    const centerY = localAnchorY - renderedHeight * 0.45;

    // 1. Quầng hào quang rực rỡ dưới gốc cây (Divine Radiant Halo)
    if (!item.divineHalo || !item.divineHalo.scene) {
      const halo = this.add.graphics();
      halo.setDepth(30);

      const radiusX = 36;
      const radiusY = 18;

      if (isMutated) {
        // Hào quang cầu vồng đa sắc huyền bí cho cây đột biến
        halo.fillStyle(0xd946ef, 0.42);
        halo.fillEllipse(0, 0, radiusX * 1.3, radiusY * 1.3);
        halo.lineStyle(2.5, 0xfbbf24, 0.85);
        halo.strokeEllipse(0, 0, radiusX * 1.15, radiusY * 1.15);
        halo.lineStyle(1.5, 0x38bdf8, 0.9);
        halo.strokeEllipse(0, 0, radiusX * 0.85, radiusY * 0.85);
      } else {
        // Hào quang hoàng kim rạng rỡ cho cây chín mọng
        halo.fillStyle(0xf59e0b, 0.38);
        halo.fillEllipse(0, 0, radiusX * 1.2, radiusY * 1.2);
        halo.lineStyle(2, 0xfde047, 0.9);
        halo.strokeEllipse(0, 0, radiusX, radiusY);
      }

      halo.setPosition(centerX, localAnchorY - 4);

      this.tweens.add({
        targets: halo,
        scaleX: { from: 0.9, to: 1.18 },
        scaleY: { from: 0.9, to: 1.18 },
        alpha: { from: 0.45, to: 0.9 },
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      item.plotContainer.add(halo);
      item.divineHalo = halo;
    } else {
      if (!item.plotContainer.exists(item.divineHalo)) {
        item.plotContainer.add(item.divineHalo);
      }
      item.divineHalo.setPosition(centerX, localAnchorY - 4);
      item.divineHalo.setDepth(30);
      item.divineHalo.setVisible(true);
    }

    // 2. Bụi sao lấp la lấp lánh bay bổng (Twinkling Fairy Stars)
    if (!item.sparkleContainer || !item.sparkleContainer.scene) {
      const container = this.add.container(centerX, centerY);
      container.setDepth(30);

      const sparkleTints = isMutated
        ? [0xffd700, 0xf472b6, 0x38bdf8, 0xc084fc, 0x4ade80]
        : [0xfff59d, 0xffd54f, 0xffca28, 0xffe082, 0xffffff];

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 16 + (i % 3) * 10;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * (radius * 0.6);

        const spark = this.add.image(px, py, FARM_ASSET_KEYS.PARTICLES.SPARKLE);
        spark.setScale(0.45 + (i % 2) * 0.3);
        spark.setTint(sparkleTints[i % sparkleTints.length]);
        spark.setAlpha(0.3);
        container.add(spark);

        this.tweens.add({
          targets: spark,
          y: py - 24 - Math.random() * 15,
          x: px + (Math.random() - 0.5) * 14,
          alpha: { from: 0.2, to: 1.0 },
          scale: { from: spark.scale * 0.6, to: spark.scale * 1.35 },
          duration: 900 + Math.random() * 600,
          yoyo: true,
          repeat: -1,
          delay: i * 180,
          ease: 'Sine.easeInOut',
        });
      }

      item.plotContainer.add(container);
      item.sparkleContainer = container;
    } else {
      if (!item.plotContainer.exists(item.sparkleContainer)) {
        item.plotContainer.add(item.sparkleContainer);
      }
      item.sparkleContainer.setPosition(centerX, centerY);
      item.sparkleContainer.setDepth(30);
      item.sparkleContainer.setVisible(true);
    }
  }

  /**
   * Đồng bộ hóa dữ liệu State từ Backend vào Phaser Scene
   */
  public syncPlotsState(plotsData: any[]) {
    if (!plotsData || !Array.isArray(plotsData)) return;

    if (!this.isVisitMode) {
      this.clearVisitBadges();
    }

    plotsData.forEach((plot) => {
      const item = this.plotItems.get(plot.plotIndex);
      if (!item || !item.tileSprite || !item.tileSprite.scene || !item.tileSprite.active) return;

      if (item.isLayoutHidden) {
        item.tileSprite.setVisible(false);
        item.tileSprite.disableInteractive();
        item.shadowSprite?.setVisible(false);
        item.cropSprite?.setVisible(false);
        item.plantContainer?.setVisible(false);
        if (item.swayTween) item.swayTween.pause();
        this.clearPlotSparkleEffects(item);
        item.harvestBadge?.setVisible(false);
        return;
      }

      // Đảm bảo tileSprite luôn hiển thị cho các ô đất hợp lệ
      item.tileSprite.setVisible(true);
      item.tileSprite.setAlpha(1.0);

      item.data = plot;
      const { status, cropInstance } = plot;
      const depth = Math.round(item.plotContainer.y * 10);
      item.plotContainer.setDepth(depth);

      // 1. Cập nhật Texture Ô đất (chuẩn hóa kích thước bằng applyPlotTileMetrics)
      if (status === 'LOCKED') {
        this.applyPlotTileMetrics(item.tileSprite, FARM_ASSET_KEYS.PLOTS.LOCKED_WILD);
        item.shadowSprite?.setVisible(false);
        item.cropSprite?.setVisible(false);
        item.plantContainer?.setVisible(false);
        if (item.swayTween) item.swayTween.pause();
        this.clearPlotSparkleEffects(item);
        item.harvestBadge?.setVisible(false);
        const oldVisitBadge = this.visitTheftBadges.get(plot.plotIndex);
        if (oldVisitBadge) {
          oldVisitBadge.destroy();
          this.visitTheftBadges.delete(plot.plotIndex);
        }
        return;
      }

      if (status === 'WATERED') {
        this.applyPlotTileMetrics(item.tileSprite, FARM_ASSET_KEYS.PLOTS.WATERED);
      } else if (status === 'READY') {
        this.applyPlotTileMetrics(item.tileSprite, FARM_ASSET_KEYS.PLOTS.READY_GLOW);
      } else {
        this.applyPlotTileMetrics(item.tileSprite, FARM_ASSET_KEYS.PLOTS.EMPTY);
      }

      // 2. Cập nhật Cây trồng nếu có (Chuẩn hóa kích thước qua CropScaleResolver)
      if (cropInstance && cropInstance.crop) {
        const crop = cropInstance.crop;
        const isReadyPlot = !!plot.isReady || status === 'READY';
        const stage = isReadyPlot ? 5 : (plot.growthState?.stage ?? cropInstance.calculatedStage ?? 0);
        item.currentRenderedStage = stage;
        const isMutated = cropInstance.isMutated;
        const mutation = cropInstance.mutation;

        let cropTextureKey = isMutated
          ? getMutationTextureKey(mutation?.code || crop.code)
          : getCropTextureKey(crop.code, stage);

        if (!this.textures.exists(cropTextureKey)) {
          const safeFallback = getCropTextureKey(crop.code, isReadyPlot ? 5 : stage);
          if (this.textures.exists(safeFallback)) {
            cropTextureKey = safeFallback;
          }
        }

        const resolution = cropScaleResolver.resolveCropVisual(
          crop.code,
          stage,
          0,
          0,
          this.textures.get(cropTextureKey),
          isMutated,
          mutation?.code || (isMutated ? crop.code : ''),
          item.data?.styleConfig
        );

        // =========================================================================
        // RENDER CÂY TRỒNG TRÊN Ô ĐẤT:
        // CÂY PHẢI NẰM CHÍNH XÁC TRÊN Ô ĐẤT ĐÃ TRỒNG, NGUYÊN VẸN 100% GỐC & RỄ
        // KHÔNG CẮT FRAME, KHÔNG MASK, KHÔNG CẮT XÉN, KHÔNG MẤT PHẦN GỐC
        // =========================================================================
        const S = resolution.scale;
        const localAnchorX = resolution.anchorX;
        const localAnchorY = resolution.anchorY;

        // Dọn dẹp triệt để các layer cắt ảnh cũ nếu có
        if (item.plantTopContainer) {
          item.plantTopContainer.destroy();
          item.plantTopContainer = undefined;
          item.plantTopSprite = undefined;
        }
        if (item.plantBaseSprite) {
          item.plantBaseSprite.destroy();
          item.plantBaseSprite = undefined;
        }

        if (!item.plantContainer) {
          item.plantContainer = this.add.container(localAnchorX, localAnchorY);
          item.plotContainer.add(item.plantContainer);
          item.plantContainer.setDepth(20);

          // CÂY HIỂN THỊ NGUYÊN VẸN 100% TỪ GỐC ĐẾN NGỌN:
          // Origin (0.5, 1.0) bảo đảm toàn bộ gốc, rễ, mô đất và sỏi đá ở đáy ảnh bám sát mặt đất.
          item.cropSprite = this.add
            .image(0, 0, cropTextureKey)
            .setOrigin(resolution.originX, resolution.originY)
            .setScale(S);
          item.plantContainer.add(item.cropSprite);

          // Interactive Hit Area trên plantContainer (vị trí cố định không dao động)
          const hitW = resolution.hitArea.width * S;
          const hitH = resolution.hitArea.height * S;
          item.plantContainer.setSize(hitW, hitH);
          item.plantContainer.setInteractive(
            new Phaser.Geom.Rectangle(-hitW * 0.5, -hitH, hitW, hitH),
            Phaser.Geom.Rectangle.Contains
          );
          if (item.plantContainer.input) {
            item.plantContainer.input.cursor = 'pointer';
          }
          this.bindSafeTap(item.plantContainer, () => {
            this.handlePlotClick(plot.plotIndex);
          });

          // Animation SWAY tự nhiên quanh điểm neo gốc:
          // Với origin (0.5, 1.0), gốc cây tại (0, 0) đứng yên tuyệt đối 0px,
          // phần thân và cành lá phía trên lắc nhẹ nhàng ±1.2 độ Sine.easeInOut
          item.swayTween = this.tweens.add({
            targets: item.cropSprite,
            angle: { from: -1.2, to: 1.2 },
            duration: 2400 + Math.random() * 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        } else {
          if (!item.plotContainer.exists(item.plantContainer)) {
            item.plotContainer.add(item.plantContainer);
          }
          item.plantContainer.setPosition(localAnchorX, localAnchorY);
          item.plantContainer.setDepth(20);

          if (item.cropSprite) {
            item.cropSprite.setTexture(cropTextureKey);
            item.cropSprite.setOrigin(resolution.originX, resolution.originY);
            item.cropSprite.setScale(S);
            item.cropSprite.setVisible(true);
          } else {
            item.cropSprite = this.add
              .image(0, 0, cropTextureKey)
              .setOrigin(resolution.originX, resolution.originY)
              .setScale(S);
            item.plantContainer.add(item.cropSprite);
          }

          item.plantContainer.setVisible(true);
          if (item.swayTween && item.swayTween.isPaused()) {
            item.swayTween.resume();
          }
        }

        if (item.shadowSprite) {
          if (!item.plotContainer.exists(item.shadowSprite)) {
            item.plotContainer.add(item.shadowSprite);
          }
          item.shadowSprite.setPosition(localAnchorX, localAnchorY - 2);
          item.shadowSprite.setSize(resolution.shadowWidth, resolution.shadowHeight);
          item.shadowSprite.setAlpha(resolution.shadowAlpha);
          item.shadowSprite.setDepth(0);
          item.shadowSprite.setVisible(true);
        }

        // 3. Huy hiệu tương tác: Huy hiệu Ghé Thăm (Trộm / Tưới) HOẶC Huy hiệu Thu Hoạch cá nhân
        const oldVisitBadge = this.visitTheftBadges.get(plot.plotIndex);
        if (oldVisitBadge) {
          oldVisitBadge.destroy();
          this.visitTheftBadges.delete(plot.plotIndex);
        }

        const badgeY = localAnchorY - resolution.renderedVisibleHeight - 18;

        if (this.isVisitMode) {
          // Ẩn liềm thu hoạch và hiệu ứng lấp lánh cá nhân
          item.harvestBadge?.setVisible(false);
          item.readyGlow?.setVisible(false);

          if (plot.canGather) {
            // HUY HIỆU BÀN TAY HÁI TRỘM (THEFT BADGE - Tham khảo Hình 3 gốc: Vòng tròn tím, bàn tay trắng, viền vàng)
            const badgeContainer = this.add.container(localAnchorX, badgeY);
            badgeContainer.setDepth(40);

            const bgGlow = this.add.graphics();
            bgGlow.fillStyle(0x7c3aed, 0.95);
            bgGlow.fillCircle(0, 0, 19);
            bgGlow.lineStyle(2.5, 0xfbbf24, 1);
            bgGlow.strokeCircle(0, 0, 19);

            const handIcon = this.add.text(0, -1, '🖐️', {
              fontSize: '18px',
            }).setOrigin(0.5, 0.5);

            badgeContainer.add([bgGlow, handIcon]);
            badgeContainer.setSize(38, 38);
            badgeContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 19), Phaser.Geom.Circle.Contains);
            badgeContainer.input?.cursor && (badgeContainer.input.cursor = 'pointer');

            this.bindSafeTap(badgeContainer, () => {
              this.handlePlotClick(plot.plotIndex);
            });

            this.tweens.add({
              targets: badgeContainer,
              y: badgeY - 8,
              duration: 750,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });

            item.plotContainer.add(badgeContainer);
            this.visitTheftBadges.set(plot.plotIndex, badgeContainer);
          } else if (plot.canWater || plot.needWater) {
            // HUY HIỆU TƯỚI NƯỚC GIÚP BẠN BÈ (Vòng tròn lam, giọt nước)
            const badgeContainer = this.add.container(localAnchorX, badgeY);
            badgeContainer.setDepth(40);

            const bgGlow = this.add.graphics();
            bgGlow.fillStyle(0x0284c7, 0.95);
            bgGlow.fillCircle(0, 0, 16);
            bgGlow.lineStyle(2, 0x7dd3fc, 1);
            bgGlow.strokeCircle(0, 0, 16);

            const waterIcon = this.add.text(0, -1, '💧', {
              fontSize: '14px',
            }).setOrigin(0.5, 0.5);

            badgeContainer.add([bgGlow, waterIcon]);
            badgeContainer.setSize(32, 32);
            badgeContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 16), Phaser.Geom.Circle.Contains);
            badgeContainer.input?.cursor && (badgeContainer.input.cursor = 'pointer');

            this.bindSafeTap(badgeContainer, () => {
              this.handlePlotClick(plot.plotIndex);
            });

            this.tweens.add({
              targets: badgeContainer,
              y: badgeY - 7,
              duration: 800,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });

            item.plotContainer.add(badgeContainer);
            this.visitTheftBadges.set(plot.plotIndex, badgeContainer);
          } else if (plot.isProtected) {
            // HUY HIỆU BẢO VỆ CÂY TRỒNG
            const badgeContainer = this.add.container(localAnchorX, badgeY);
            badgeContainer.setDepth(40);

            const bgGlow = this.add.graphics();
            bgGlow.fillStyle(0x334155, 0.9);
            bgGlow.fillCircle(0, 0, 15);
            bgGlow.lineStyle(1.5, 0x94a3b8, 0.9);
            bgGlow.strokeCircle(0, 0, 15);

            const shieldIcon = this.add.text(0, -1, '🛡️', {
              fontSize: '13px',
            }).setOrigin(0.5, 0.5);

            badgeContainer.add([bgGlow, shieldIcon]);
            item.plotContainer.add(badgeContainer);
            this.visitTheftBadges.set(plot.plotIndex, badgeContainer);
          }
        } else {
          // VƯỜN CỦA TÔI: Huy hiệu thu hoạch hình liềm khi cây chín (Phóng to đúng x2.5: 75x75, vị trí bám đỉnh cây)
          if (status === 'READY' || stage >= 5) {
            if (!item.harvestBadge) {
              item.harvestBadge = this.add
                .image(localAnchorX, badgeY, FARM_ASSET_KEYS.UI.HARVEST_BADGE)
                .setOrigin(0.5, 0.5)
                .setDisplaySize(75, 75)
                .setDepth(40)
                .setInteractive({ useHandCursor: true });

              item.plotContainer.add(item.harvestBadge);

              this.bindSafeTap(item.harvestBadge, () => {
                this.handlePlotClick(plot.plotIndex);
              });

              this.tweens.add({
                targets: item.harvestBadge,
                y: badgeY - 8,
                duration: 900,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
              });
            } else {
              if (!item.plotContainer.exists(item.harvestBadge)) {
                item.plotContainer.add(item.harvestBadge);
              }
              item.harvestBadge.setPosition(localAnchorX, badgeY);
              item.harvestBadge.setDisplaySize(75, 75);
              item.harvestBadge.setDepth(40);
              item.harvestBadge.setVisible(true);
            }

          } else {
            item.harvestBadge?.setVisible(false);
          }
        }

        // Cập nhật hiệu ứng hào quang thần tiên & bụi sao lấp la lấp lánh (cho cả cá nhân & ghé thăm bạn bè)
        this.updatePlotSparkleEffects(
          item,
          20,
          isReadyPlot,
          !!isMutated,
          localAnchorX,
          localAnchorY,
          resolution.renderedVisibleHeight
        );

        // BẢO ĐẢM THỨ TỰ LAYER TRONG TỪNG FarmPlotNode:
        // Shadow (0) < Tile (10) < Plant (20) < Effects (30) < Badge/Buttons (40)
        item.plotContainer.sort('depth');
      } else {
        item.currentRenderedStage = undefined;
        item.cropSprite?.setVisible(false);
        item.plantContainer?.setVisible(false);
        if (item.swayTween) item.swayTween.pause();
        item.shadowSprite?.setVisible(false);
        this.clearPlotSparkleEffects(item);
        item.harvestBadge?.setVisible(false);
        const oldVisitBadge = this.visitTheftBadges.get(plot.plotIndex);
        if (oldVisitBadge) {
          oldVisitBadge.destroy();
          this.visitTheftBadges.delete(plot.plotIndex);
        }
      }
    });

    const isVisualScaleDebug =
      typeof window !== 'undefined' &&
      ((window as any).FARM_DEBUG_VISUAL_SCALE === true ||
        localStorage.getItem('FARM_DEBUG_VISUAL_SCALE') === 'true');
    if (isVisualScaleDebug) {
      this.renderDebugVisualScaleOverlay();
    }
  }

  /**
   * Hiển thị bóng mờ cây trồng khi người chơi đang chọn hạt giống trong Seed Tray
   */
  public showPlantPreview(plotIndex: number, cropCode: string) {
    this.clearPlantPreview();
    const item = this.plotItems.get(plotIndex);
    if (!item) return;

    const textureKey = getCropTextureKey(cropCode, 5);
    const texture = this.textures.get(textureKey);
    const resolution = cropScaleResolver.resolveCropVisual(
      cropCode,
      5,
      item.plotContainer.x,
      item.plotContainer.y,
      texture
    );

    this.ghostCropSprite = this.add
      .image(resolution.anchorX, resolution.anchorY, textureKey)
      .setOrigin(resolution.originX, resolution.originY)
      .setScale(resolution.scale)
      .setAlpha(0.6)
      .setDepth(item.tileSprite.depth + 10);

    this.tweens.add({
      targets: this.ghostCropSprite,
      alpha: { from: 0.45, to: 0.75 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Xóa bỏ bóng mờ cây trồng
   */
  public clearPlantPreview() {
    if (this.ghostCropSprite) {
      this.ghostCropSprite.destroy();
      this.ghostCropSprite = null;
    }
  }

  /**
   * Hoạt cảnh tưới nước: Giọt nước bắn xuống + Cây bật nảy vui tươi
   */
  public playWateringAnimation(plotIndex: number) {
    const item = this.plotItems.get(plotIndex);
    if (!item) return;

    for (let i = 0; i < 8; i++) {
      const drop = this.add
        .circle(
          item.plotContainer.x + (Math.random() * 40 - 20),
          item.plotContainer.y - 45,
          3,
          0x38bdf8,
          0.9
        )
        .setDepth(item.plotContainer.depth + 25);

      this.tweens.add({
        targets: drop,
        y: item.plotContainer.y - 10 + Math.random() * 15,
        alpha: 0,
        duration: 400 + Math.random() * 200,
        ease: 'Quad.easeIn',
        onComplete: () => drop.destroy(),
      });
    }

    const animTarget = item.plantContainer || item.cropSprite;
    if (animTarget) {
      this.tweens.add({
        targets: animTarget,
        scaleY: animTarget.scaleY * 1.15,
        scaleX: animTarget.scaleX * 0.92,
        duration: 120,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  /**
   * Hoạt cảnh thu hoạch: Cây squash-and-stretch, camera micro punch, hạt sáng bung tỏa
   */
  public playHarvestAnimation(plotIndex: number, onComplete?: () => void) {
    const item = this.plotItems.get(plotIndex);
    if (!item) return;

    if (this.cameras?.main) {
      try {
        this.cameras.main.shake(100, 0.003);
      } catch {}
    }

    this.clearPlotSparkleEffects(item);

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 35 + Math.random() * 25;
      const spark = this.add
        .image(
          item.plotContainer.x,
          item.plotContainer.y - 30,
          FARM_ASSET_KEYS.PARTICLES.SPARKLE
        )
        .setDepth(item.plotContainer.depth + 30)
        .setScale(0.8);

      this.tweens.add({
        targets: spark,
        x: item.plotContainer.x + Math.cos(angle) * dist,
        y: item.plotContainer.y - 30 + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }

    const animTarget = item.plantContainer || item.cropSprite;
    if (animTarget) {
      const curScaleX = animTarget.scaleX;
      const curScaleY = animTarget.scaleY;
      const startY = animTarget.y;
      this.tweens.add({
        targets: animTarget,
        y: startY - 25,
        scaleX: curScaleX * 1.18,
        scaleY: curScaleY * 1.18,
        alpha: 0,
        duration: 350,
        ease: 'Back.easeIn',
        onComplete: () => {
          animTarget.setVisible(false);
          animTarget.setAlpha(1);
          animTarget.y = startY;
          animTarget.scaleX = curScaleX;
          animTarget.scaleY = curScaleY;
          item.cropSprite?.setVisible(false);
          item.plantContainer?.setVisible(false);
          if (item.swayTween) item.swayTween.pause();
          item.harvestBadge?.setVisible(false);
          this.clearPlotSparkleEffects(item);
          onComplete?.();
        },
      });
    } else {
      item.harvestBadge?.setVisible(false);
      this.clearPlotSparkleEffects(item);
      onComplete?.();
    }
  }

  /**
   * Kích hoạt Hoạt cảnh Đột biến Thần kỳ (Mutation Reveal Animation)
   */
  public playMutationReveal(plotIndex: number, mutationCode: string) {
    const item = this.plotItems.get(plotIndex);
    const animTarget = item?.plantContainer || item?.cropSprite;
    if (!item || !animTarget) return;

    this.tweens.add({
      targets: animTarget,
      x: '+=6',
      duration: 60,
      yoyo: true,
      repeat: 8,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.cameras?.main) {
          try {
            this.cameras.main.flash(400, 255, 235, 120);
          } catch {}
        }

        let mutationTextureKey = getMutationTextureKey(mutationCode);
        const cropCode = item.data?.cropInstance?.crop?.code || 'MUTATION';
        if (!this.textures.exists(mutationTextureKey)) {
          const safeFallback = getCropTextureKey(cropCode, 5);
          if (this.textures.exists(safeFallback)) {
            mutationTextureKey = safeFallback;
          }
        }
        const resolution = cropScaleResolver.resolveCropVisual(
          cropCode,
          5,
          0,
          0,
          this.textures.get(mutationTextureKey),
          true,
          mutationCode
        );

        if (item.plantContainer) {
          if (item.plantTopContainer) {
            item.plantTopContainer.destroy();
            item.plantTopContainer = undefined;
            item.plantTopSprite = undefined;
          }
          if (item.plantBaseSprite) {
            item.plantBaseSprite.destroy();
            item.plantBaseSprite = undefined;
          }

          item.plantContainer.setPosition(resolution.anchorX, resolution.anchorY);
          if (item.cropSprite) {
            item.cropSprite.setTexture(mutationTextureKey);
            item.cropSprite.setOrigin(resolution.originX, resolution.originY);
            item.cropSprite.setScale(resolution.scale);
            item.cropSprite.setVisible(true);
          } else {
            item.cropSprite = this.add
              .image(0, 0, mutationTextureKey)
              .setOrigin(resolution.originX, resolution.originY)
              .setScale(resolution.scale);
            item.plantContainer.add(item.cropSprite);
          }
        } else if (item.cropSprite) {
          item.cropSprite.setTexture(mutationTextureKey);
          item.cropSprite.setPosition(resolution.anchorX, resolution.anchorY);
          item.cropSprite.setOrigin(resolution.originX, resolution.originY);
          item.cropSprite.setScale(resolution.scale);
        }

        const baseScaleX = animTarget.scaleX ?? resolution.scale;
        const baseScaleY = animTarget.scaleY ?? resolution.scale;

        this.tweens.add({
          targets: animTarget,
          scaleX: baseScaleX * 1.15,
          scaleY: baseScaleY * 1.15,
          duration: 300,
          yoyo: true,
          ease: 'Back.easeOut',
        });
      },
    });
  }

  /**
   * Hoạt cảnh Đào Cây (Nhổ Cây):
   * Rung lắc đất nhẹ, bắn bụi đất nâu (0x5d4037), cây co nhỏ và giật ngược lên rồi tiêu biến mượt mà trong ~380ms.
   */
  public playUprootAnimation(plotIndex: number, onComplete?: () => void) {
    const item = this.plotItems.get(plotIndex);
    if (!item) return;

    this.cameras.main.shake(100, 0.002);

    // Bụi đất văng lên (Soil dirt particles)
    for (let i = 0; i < 8; i++) {
      const pX = item.plotContainer.x + (Math.random() * 32 - 16);
      const pY = item.plotContainer.y + (Math.random() * 16 - 8);
      const dirt = this.add
        .circle(pX, pY, 2.5 + Math.random() * 2, 0x5d4037, 0.9)
        .setDepth(item.plotContainer.depth + 25);

      this.tweens.add({
        targets: dirt,
        x: pX + (Math.random() * 36 - 18),
        y: pY - 20 - Math.random() * 15,
        alpha: 0,
        scale: 0.3,
        duration: 450 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => dirt.destroy(),
      });
    }

    const animTarget = item.plantContainer || item.cropSprite;
    if (animTarget) {
      const curScaleX = animTarget.scaleX;
      const curScaleY = animTarget.scaleY;
      const startY = animTarget.y;
      this.tweens.add({
        targets: animTarget,
        y: startY - 20,
        scaleX: curScaleX * 0.35,
        scaleY: curScaleY * 0.35,
        alpha: 0,
        duration: 380,
        ease: 'Back.easeIn',
        onComplete: () => {
          animTarget.setVisible(false);
          animTarget.setAlpha(1);
          animTarget.y = startY;
          animTarget.scaleX = curScaleX;
          animTarget.scaleY = curScaleY;
          item.cropSprite?.setVisible(false);
          item.plantContainer?.setVisible(false);
          if (item.swayTween) item.swayTween.pause();
          item.shadowSprite?.setVisible(false);
          item.readyGlow?.setVisible(false);
          item.harvestBadge?.setVisible(false);
          onComplete?.();
        },
      });
    } else {
      item.shadowSprite?.setVisible(false);
      item.readyGlow?.setVisible(false);
      item.harvestBadge?.setVisible(false);
      onComplete?.();
    }
  }

  private setupEventListeners() {
    farmEventBus.on('WEATHER_CHANGED', (weather: string) => {
      const isNight = weather === 'NIGHT';
      if (this.nightMoonlightGlow) {
        this.tweens.add({
          targets: this.nightMoonlightGlow,
          alpha: isNight ? 0.08 : 0,
          duration: 800,
          ease: 'Sine.easeInOut',
        });
      }
      if (this.nightWarmLanternGlow) {
        this.tweens.add({
          targets: this.nightWarmLanternGlow,
          alpha: isNight ? 0.05 : 0,
          duration: 800,
          ease: 'Sine.easeInOut',
        });
      }
    });

    farmEventBus.on('SYNC_STATE', (data: { plots: any[] }) => {
      this.syncPlotsState(data.plots);
    });

    farmEventBus.on('ENTER_VISIT_MODE', (data: { plots: any[]; friendUser?: any; isFriend?: boolean }) => {
      this.isVisitMode = true;
      this.visitingData = data;
      this.syncPlotsState(data.plots);
    });

    farmEventBus.on('EXIT_VISIT_MODE', () => {
      this.isVisitMode = false;
      this.visitingData = null;
      this.clearVisitBadges();
    });

    farmEventBus.on('FOCUS_PLOT', (plotIndex: number) => {
      const item = this.plotItems.get(plotIndex);
      if (item) {
        this.cameraControls.focusOnPlot(item.plotContainer.x, item.plotContainer.y);
      }
    });

    farmEventBus.on('RESET_CAMERA', () => {
      this.cameraControls.centerOnWorld(0, FarmWorldLayoutConfig.CAMERA.DEFAULT_CENTER_Y);
    });

    farmEventBus.on('MUTATION_REVEAL', (data: { plotIndex: number; mutationCode: string }) => {
      this.playMutationReveal(data.plotIndex, data.mutationCode);
    });

    farmEventBus.on('SHOW_PLANT_PREVIEW', (data: { plotIndex: number; cropCode: string }) => {
      this.showPlantPreview(data.plotIndex, data.cropCode);
    });

    farmEventBus.on('CLEAR_PLANT_PREVIEW', () => {
      this.clearPlantPreview();
    });

    farmEventBus.on('PLAY_WATERING_ANIM', (plotIndex: number) => {
      this.playWateringAnimation(plotIndex);
    });

    farmEventBus.on('PLAY_HARVEST_ANIM', (plotIndex: number) => {
      this.playHarvestAnimation(plotIndex);
    });

    farmEventBus.on('PLAY_UPROOT_ANIM', (plotIndex: number) => {
      this.playUprootAnimation(plotIndex);
    });

    farmEventBus.on('SET_WORLD_INPUT_ACTIVE', (active: boolean) => {
      this.isWorldInputBlocked = !active;
      if (this.cameraControls) {
        this.cameraControls.setInputBlocked(!active);
      }
      if (!active) {
        this.plotItems.forEach((item) => {
          item.tileSprite.clearTint();
        });
      }
    });

    farmEventBus.on('SYNC_LUCKY_ENVELOPES', (data: { count: number; maxVisible?: number }) => {
      this.syncLuckyEnvelopes(data?.count ?? 0, data?.maxVisible ?? 8);
    });

    farmEventBus.on('DRAG_PLANT_START', (data: { validPlotIndexes: number[] }) => {
      this.highlightPlotsForPlanting(data?.validPlotIndexes ?? []);
    });

    farmEventBus.on('DRAG_PLANT_HOVER', (data: { plotIndex: number; isValid: boolean }) => {
      this.highlightHoverPlot(data.plotIndex, data.isValid);
    });

    farmEventBus.on('DRAG_PLANT_END', () => {
      this.clearPlotHighlights();
    });

    farmEventBus.on('WATER_MODE_START', (data?: { dryPlotIndexes?: number[] }) => {
      this.clearPlotHighlights();
      if (data?.dryPlotIndexes) {
        data.dryPlotIndexes.forEach((idx) => {
          const item = this.plotItems.get(idx);
          if (item) item.tileSprite.setTint(0x93c5fd);
        });
      }
    });

    farmEventBus.on('WATER_MODE_END', () => {
      this.clearPlotHighlights();
    });

    farmEventBus.on('WATER_SPLASH', (data: { plotIndex: number }) => {
      if (typeof data?.plotIndex === 'number') {
        this.playWaterSplashAnim(data.plotIndex);
      }
    });

    // =========================================================================
    // GLOBAL GARDEN LAYOUT EVENT LISTENERS
    // =========================================================================
    farmEventBus.on('SET_GARDEN_LAYOUT', (data: { layout: any; editorMode?: boolean }) => {
      this.applyGardenLayout(data?.layout, data?.editorMode ?? false);
    });

    farmEventBus.emit('REQUEST_GARDEN_LAYOUT');

    farmEventBus.on('SELECT_GARDEN_OBJECT', (objectKey: string | null) => {
      this.selectedGardenObjectKey = objectKey;
      this.drawEditorSelectionGizmo();
    });

    farmEventBus.on('SET_EDITOR_MODE', (active: boolean) => {
      this.isEditorMode = Boolean(active);
      if (!active) {
        this.selectedGardenObjectKey = null;
        this.editorGizmoGraphics?.clear();
        this.editorSnapLineGraphics?.clear();
      }
      this.syncEditorInteractivity();
    });

    farmEventBus.on('GARDEN_SET_ASPECT_LOCK', (locked: boolean) => {
      this.isGizmoAspectLocked = Boolean(locked);
    });

    farmEventBus.on('RESET_PLOT_POSITION', (data: { plotIndex: number }) => {
      const pIdx = data.plotIndex;
      const plotItem = this.plotItems.get(pIdx);
      if (!plotItem) return;

      const originX = FarmWorldLayoutConfig.GRID_ORIGIN_X;
      const originY = FarmWorldLayoutConfig.GRID_ORIGIN_Y;
      const row = Math.floor(pIdx / 5);
      const col = pIdx % 5;
      const { x, y } = this.grid.gridToWorld(row, col, originX, originY);

      plotItem.plotContainer.setPosition(x, y);
      plotItem.data.worldX = x;
      plotItem.data.worldY = y;

      this.selectedGardenObjectKey = `plot_${pIdx}`;
      this.drawEditorSelectionGizmo();

      farmEventBus.emit('GARDEN_OBJECT_TRANSFORMED', {
        objectKey: `plot_${pIdx}`,
        positionX: x,
        positionY: y,
      });
    });
  }

  /**
   * Đồng bộ toàn diện Bố cục khu vườn toàn cục (Global Garden Layout)
   * Render các ô đất và các vật trang trí, cây cối, hiệu ứng từ layout
   */
  public applyGardenLayout(layoutData: any, isEditor: boolean = false) {
    if (!layoutData || !Array.isArray(layoutData.objects)) return;
    this.currentLayout = layoutData;
    this.isEditorMode = isEditor;

    const theme = getFarmUIPreferences().theme;
    const isNight = theme === 'NIGHT';
    const isMobile = this.cameraControls?.isMobileDevice() ?? false;

    const activeKeys = new Set<string>();
    const layoutPlotIndices = new Set<number>();

    for (const obj of layoutData.objects) {
      activeKeys.add(obj.objectKey);

      // 1. Ô ĐẤT (PLOT)
      if (obj.objectType === 'PLOT') {
        const pIdx = obj.plotIndex;
        if (pIdx !== null && pIdx !== undefined) {
          layoutPlotIndices.add(pIdx);
          const plotItem = this.plotItems.get(pIdx);
          if (plotItem) {
            const isVisible = obj.isVisible !== false;
            plotItem.isLayoutHidden = !isVisible;

            // Master Container FarmPlotNode nhận toàn bộ vị trí thế giới & góc xoay
            plotItem.plotContainer.setPosition(obj.positionX, obj.positionY);
            // Chuẩn hóa depth nghiêm ngặt theo trục Y trong không gian 2.5D Isometric
            plotItem.plotContainer.setDepth(Math.round(obj.positionY * 10));
            plotItem.plotContainer.setRotation((obj.rotation || 0) * (Math.PI / 180));
            plotItem.plotContainer.setVisible(isVisible);
            plotItem.tileSprite.setVisible(isVisible);

            // Scale áp dụng cho cả ô đất (cây và các layer con tự bám theo)
            const scaleX = obj.scaleX ?? 1.0;
            const scaleY = obj.scaleY ?? 1.0;
            plotItem.plotContainer.setScale(scaleX, scaleY);

            plotItem.data.worldX = obj.positionX;
            plotItem.data.worldY = obj.positionY;
            plotItem.data.styleConfig = obj.styleConfig;
            plotItem.data.width = obj.width;
            plotItem.data.height = obj.height;
            plotItem.data.scaleX = scaleX;
            plotItem.data.scaleY = scaleY;

            if (plotItem.plantContainer) {
              const plantScale = obj.styleConfig?.plantScale ?? 1.0;
              plotItem.plantContainer.setScale(plantScale);
              plotItem.plantContainer.setVisible(isVisible && !!plotItem.data?.cropInstance);
            }
            if (plotItem.shadowSprite) {
              plotItem.shadowSprite.setVisible(isVisible && !!plotItem.data?.cropInstance);
            }
            if (plotItem.harvestBadge) {
              plotItem.harvestBadge.setVisible(isVisible && plotItem.data?.status === 'READY');
            }
            if (!isVisible) {
              this.clearPlotSparkleEffects(plotItem);
            }

            if (this.isEditorMode) {
              // Trong Editor Mode: Tắt triệt để tương tác trên sprite con, chỉ plotContainer là draggable
              plotItem.tileSprite.disableInteractive();
              plotItem.plantContainer?.disableInteractive();
              plotItem.harvestBadge?.disableInteractive();
              this.enableEditorDragForObject(plotItem.plotContainer, obj.objectKey, 'PLOT', pIdx);
            } else {
              // Trong Gameplay Mode: plotContainer không draggable, khôi phục tương tác cho tileSprite
              plotItem.plotContainer.disableInteractive();
              if (isVisible) {
                const currentTexture = plotItem.tileSprite.texture?.key || FARM_ASSET_KEYS.PLOTS.EMPTY;
                this.applyPlotTileMetrics(plotItem.tileSprite, currentTexture);
                plotItem.tileSprite.setVisible(true);
              } else {
                plotItem.tileSprite.setVisible(false);
                plotItem.tileSprite.disableInteractive();
              }
            }
          }
        }
        continue;
      }

      // 2. HERO OBJECT: CÂY THẦN AVORA
      if (
        (obj.objectKey === 'prop_avora_tree' || obj.name === 'Cây Thần AVORA' || (obj.objectType === 'TREE' && obj.objectKey?.includes('tree'))) &&
        this.treeContainer
      ) {
        const isVisible = obj.isVisible !== false;
        this.treeContainer.setPosition(obj.positionX, obj.positionY);
        this.treeContainer.setDepth(obj.zIndex ?? 720);
        this.treeContainer.setVisible(isVisible);
        if (this.treeShadow) {
          this.treeShadow.setPosition(obj.positionX, obj.positionY + 2);
          this.treeShadow.setDepth((obj.zIndex ?? 720) - 1);
          this.treeShadow.setVisible(isVisible);
        }
        if (obj.scaleX) {
          this.treeContainer.setScale(obj.scaleX, obj.scaleY || obj.scaleX);
        }
        if (this.isEditorMode) {
          this.enableEditorDragForObject(this.treeContainer, obj.objectKey, 'TREE');
        }
        continue;
      }

      // Check displayMode & deviceMode cho các vật trang trí khác
      if (obj.displayMode === 'DAY_ONLY' && isNight && !this.isEditorMode) continue;
      if (obj.displayMode === 'NIGHT_ONLY' && !isNight && !this.isEditorMode) continue;
      if (obj.deviceMode === 'DESKTOP_ONLY' && isMobile && !this.isEditorMode) continue;
      if (obj.deviceMode === 'MOBILE_ONLY' && !isMobile && !this.isEditorMode) continue;

      // 3. VẬT PHẨM TRANG TRÍ (DECORATION, TREE, EFFECT)
      this.renderDecorationObject(obj);
    }

    // ẨN CÁC Ô ĐẤT BỊ XÓA KHỎI LAYOUT HOẶC KHÔNG CÒN TRONG DANH SÁCH LAYOUT
    for (const [pIdx, plotItem] of this.plotItems.entries()) {
      if (!layoutPlotIndices.has(pIdx)) {
        plotItem.isLayoutHidden = true;
        plotItem.tileSprite.setVisible(false);
        plotItem.tileSprite.disableInteractive();
        if (plotItem.plantContainer) plotItem.plantContainer.setVisible(false);
        if (plotItem.shadowSprite) plotItem.shadowSprite.setVisible(false);
        if (plotItem.harvestBadge) plotItem.harvestBadge.setVisible(false);
        this.clearPlotSparkleEffects(plotItem);
      }
    }

    // Dọn dẹp các decoration không còn trong layout
    for (const [key, decItem] of this.gardenDecorationsMap.entries()) {
      if (!activeKeys.has(key)) {
        decItem.container.destroy();
        this.gardenDecorationsMap.delete(key);
      }
    }
  }

  /**
   * Render một vật phẩm trang trí / cây cối / hiệu ứng từ layout
   */
  private renderDecorationObject(obj: any) {
    const key = obj.objectKey;
    let decItem = this.gardenDecorationsMap.get(key);

    let textureKey = obj.objectKey;
    if (obj.asset) {
      textureKey = `garden_asset_${obj.asset.code}`;
      if (!this.textures.exists(textureKey)) {
        const imgUrl = obj.asset.webpUrl || obj.asset.fallbackUrl || obj.asset.originalUrl;
        if (imgUrl) {
          this.load.image(textureKey, imgUrl);
          this.load.once(`filecomplete-image-${textureKey}`, () => {
            this.renderDecorationObject(obj);
          });
          this.load.start();
          return;
        }
      }
    }

    if (!this.textures.exists(textureKey)) {
      return;
    }

    const animConfig = obj.animationConfig || {};
    const preset = animConfig.preset || 'NONE';
    const isSwayWithStaticBase = (preset === 'SWAY' || preset === 'SWAY_SOFT') && animConfig.staticBaseEnabled;

    if (!decItem) {
      if (isSwayWithStaticBase) {
        const staticRatio = animConfig.staticBaseRatio ?? 0.28;
        const overlapPx = animConfig.overlapPx ?? 14;
        const featherPx = animConfig.featherPx ?? 6;
        const frames = this.getOrCreateSeamlessPlantFrames(textureKey, staticRatio, overlapPx, featherPx);
        const scaleX = obj.scaleX || 1.0;
        const scaleY = obj.scaleY || 1.0;

        const container = this.add.container(obj.positionX, obj.positionY);
        container.setDepth(obj.zIndex || 0);

        const Y_pivot = -(frames.rawH - frames.pivotY_tex) * scaleY;

        // 1. PlantAnimatedTop (topContainer): NẰM PHÍA SAU, đung đưa quanh pivot
        const topContainer = this.add.container(0, Y_pivot);
        const topSprite = this.add.image(0, 0, frames.textureKey, frames.topFrameKey)
          .setOrigin(animConfig.swayPivotX ?? (obj.anchorX ?? 0.5), frames.topOriginY)
          .setScale(scaleX, scaleY);
        topContainer.add(topSprite);
        container.add(topContainer); // Thêm trước -> nằm phía sau

        // 2. PlantStaticBase (baseSprite): NẰM PHÍA TRƯỚC, đứng yên 100%, mép trên có mask feather che đường nối
        const baseSprite = this.add.image(0, 0, frames.baseTextureKey, frames.baseFrameName)
          .setOrigin(obj.anchorX ?? 0.5, 1.0)
          .setScale(scaleX, scaleY);
        container.add(baseSprite); // Thêm sau -> nằm phía trước

        const amplitude = Math.min(2.0, Math.max(0.8, animConfig.rotationAmplitude || 1.2));
        const tween = this.tweens.add({
          targets: topContainer,
          angle: { from: -amplitude, to: amplitude },
          duration: animConfig.duration || 3000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        decItem = { objData: obj, container, baseSprite, topContainer, topSprite, tween };
        this.gardenDecorationsMap.set(key, decItem);
      } else {
        const sprite = this.add.image(obj.positionX, obj.positionY, textureKey)
          .setOrigin(obj.anchorX ?? 0.5, obj.anchorY ?? 1.0)
          .setScale(obj.scaleX || 1.0, obj.scaleY || 1.0)
          .setRotation((obj.rotation || 0) * (Math.PI / 180))
          .setAlpha(obj.opacity ?? 1.0)
          .setDepth(obj.zIndex || 0)
          .setFlip(Boolean(obj.flipX), Boolean(obj.flipY));

        let tween: Phaser.Tweens.Tween | undefined;
        if (preset === 'LANTERN_SWAY') {
          sprite.setOrigin(0.5, 0.0);
          tween = this.tweens.add({
            targets: sprite,
            angle: { from: -3.0, to: 3.0 },
            duration: animConfig.duration || 2600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        } else if (preset === 'FLOAT') {
          tween = this.tweens.add({
            targets: sprite,
            y: `+=${animConfig.amplitudeY || 12}`,
            duration: animConfig.duration || 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        } else if (preset === 'PULSE' || preset === 'BREATHING') {
          tween = this.tweens.add({
            targets: sprite,
            scaleX: (obj.scaleX || 1.0) * 1.06,
            scaleY: (obj.scaleY || 1.0) * 1.06,
            duration: animConfig.duration || 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        } else if (preset === 'GLOW' || preset === 'TWINKLE') {
          tween = this.tweens.add({
            targets: sprite,
            alpha: { from: 0.5, to: 1.0 },
            duration: animConfig.duration || 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }

        decItem = { objData: obj, container: sprite, sprite, tween };
        this.gardenDecorationsMap.set(key, decItem);
      }
    } else {
      decItem.objData = obj;
      decItem.container.setPosition(obj.positionX, obj.positionY);
      decItem.container.setDepth(obj.zIndex || 0);
      decItem.container.setAlpha(obj.opacity ?? 1.0);
      decItem.container.setVisible(obj.isVisible !== false);
      if (decItem.sprite) {
        decItem.sprite.setScale(obj.scaleX || 1.0, obj.scaleY || 1.0);
        decItem.sprite.setRotation((obj.rotation || 0) * (Math.PI / 180));
        decItem.sprite.setFlip(Boolean(obj.flipX), Boolean(obj.flipY));
      }
    }

    if (this.isEditorMode && decItem) {
      this.enableEditorDragForObject(decItem.container, key, obj.objectType);
    }
  }

  /**
   * Đồng bộ toàn diện tính tương tác giữa Editor Mode (chọn/kéo thả ô đất) và Gameplay Mode (click trồng cây)
   */
  public syncEditorInteractivity() {
    for (const [pIdx, plotItem] of this.plotItems.entries()) {
      if (plotItem.isLayoutHidden) continue;
      const objKey = `plot_${pIdx}`;
      if (this.isEditorMode) {
        plotItem.tileSprite.disableInteractive();
        plotItem.plantContainer?.disableInteractive();
        plotItem.harvestBadge?.disableInteractive();
        this.enableEditorDragForObject(plotItem.plotContainer, objKey, 'PLOT', pIdx);
      } else {
        plotItem.plotContainer.disableInteractive();
        const tileKey = plotItem.tileSprite.texture?.key || FARM_ASSET_KEYS.PLOTS.EMPTY;
        this.applyPlotTileMetrics(plotItem.tileSprite, tileKey);
        if (plotItem.data?.status === 'READY') {
          plotItem.harvestBadge?.setInteractive({ useHandCursor: true });
        }
      }
    }

    if (this.treeContainer) {
      if (this.isEditorMode) {
        this.enableEditorDragForObject(this.treeContainer, 'prop_avora_tree', 'TREE');
      } else {
        this.treeContainer.disableInteractive();
      }
    }
  }

  /**
   * Kích hoạt khả năng kéo thả chỉnh sửa cho object trong chế độ Editor Mode
   */
  private enableEditorDragForObject(
    target: Phaser.GameObjects.GameObject,
    objectKey: string,
    objectType: string,
    plotIndex?: number,
  ) {
    if (!this.isEditorMode || !target) return;

    const anyTarget = target as any;
    const w = (objectType === 'PLOT' ? FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH : anyTarget.width) || 264;
    const h = (objectType === 'PLOT' ? FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_HEIGHT : anyTarget.height) || 168;

    if (target instanceof Phaser.GameObjects.Container) {
      target.setSize(w, h);
      target.setInteractive(
        new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
        Phaser.Geom.Rectangle.Contains
      );
    } else if (!target.input) {
      target.setInteractive({ useHandCursor: true });
    }

    if (target.input) {
      this.input.setDraggable(target);
      target.input.cursor = 'grab';
    } else {
      return;
    }

    if ((target as any).getData?.('hasEditorDrag')) {
      return;
    }
    (target as any).setData?.('hasEditorDrag', true);

    target.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isEditorMode) return;
      if (this.cameraControls) {
        this.cameraControls.setInputBlocked(true);
      }
      if (target.input) {
        target.input.cursor = 'grabbing';
      }
      this.selectedGardenObjectKey = objectKey;
      this.drawEditorSelectionGizmo();
      farmEventBus.emit('GARDEN_OBJECT_SELECTED', objectKey);
      pointer.event.stopPropagation();
    });

    target.on('pointerup', () => {
      if (!this.isEditorMode) return;
      if (this.cameraControls) {
        this.cameraControls.setInputBlocked(false);
      }
      if (target.input) {
        target.input.cursor = 'grab';
      }
    });

    target.on('dragstart', () => {
      if (!this.isEditorMode) return;
      if (this.cameraControls) {
        this.cameraControls.setInputBlocked(true);
      }
      if (target.input) {
        target.input.cursor = 'grabbing';
      }
    });

    target.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.isEditorMode) return;

      let finalX = Math.round(dragX);
      let finalY = Math.round(dragY);

      if (this.editorSnapLineGraphics) {
        this.editorSnapLineGraphics.clear();
      }

      for (const [otherIdx, p] of this.plotItems.entries()) {
        if (p.plotIndex === plotIndex) continue;
        if (Math.abs(finalX - p.plotContainer.x) < 8) {
          finalX = p.plotContainer.x;
          this.drawSnapGuide(finalX, true);
        }
        if (Math.abs(finalY - p.plotContainer.y) < 8) {
          finalY = p.plotContainer.y;
          this.drawSnapGuide(finalY, false);
        }
      }

      (target as any).x = finalX;
      (target as any).y = finalY;

      if (objectType === 'PLOT' && plotIndex !== undefined) {
        const p = this.plotItems.get(plotIndex);
        if (p) {
          p.data.worldX = finalX;
          p.data.worldY = finalY;
        }
      }

      this.drawEditorSelectionGizmo();
      farmEventBus.emit('GARDEN_OBJECT_DRAGGING', {
        objectKey,
        positionX: finalX,
        positionY: finalY,
      });
    });

    target.on('dragend', () => {
      if (!this.isEditorMode) return;
      if (this.cameraControls) {
        this.cameraControls.setInputBlocked(false);
      }
      if (target.input) {
        target.input.cursor = 'grab';
      }
      this.editorSnapLineGraphics?.clear();
      const finalX = (target as any).x;
      const finalY = (target as any).y;
      farmEventBus.emit('GARDEN_OBJECT_TRANSFORMED', {
        objectKey,
        positionX: finalX,
        positionY: finalY,
      });
    });
  }

  private drawSnapGuide(coord: number, isVertical: boolean) {
    if (!this.editorSnapLineGraphics) {
      this.editorSnapLineGraphics = this.add.graphics().setDepth(99999);
    }
    this.editorSnapLineGraphics.lineStyle(1.5, 0xf59e0b, 0.9);
    if (isVertical) {
      this.editorSnapLineGraphics.lineBetween(coord, -1000, coord, 1500);
    } else {
      this.editorSnapLineGraphics.lineBetween(-1500, coord, 1500, coord);
    }
  }

  public drawEditorSelectionGizmo() {
    if (!this.editorGizmoGraphics) {
      this.editorGizmoGraphics = this.add.graphics().setDepth(99998);
    }
    this.editorGizmoGraphics.clear();

    if (!this.selectedGardenObjectKey) {
      this.editorGizmoHandles.forEach((h) => h.setVisible(false));
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let targetW = 100;
    let targetH = 80;
    let baseW = 100;
    let baseH = 80;
    let currentScaleX = 1.0;
    let currentScaleY = 1.0;
    let targetObject: Phaser.GameObjects.Container | Phaser.GameObjects.Image | null = null;
    let selectedType: 'PLOT' | 'TREE' | 'DECORATION' = 'DECORATION';
    let plotIdx: number | undefined;

    for (const p of this.plotItems.values()) {
      if (`plot_${p.plotIndex}` === this.selectedGardenObjectKey) {
        selectedType = 'PLOT';
        plotIdx = p.plotIndex;
        targetObject = p.plotContainer;
        targetX = p.plotContainer.x;
        targetY = p.plotContainer.y;
        baseW = p.data.width || FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH;
        baseH = p.data.height || FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_HEIGHT;
        currentScaleX = p.data.scaleX ?? p.plotContainer.scaleX ?? 1.0;
        currentScaleY = p.data.scaleY ?? p.plotContainer.scaleY ?? 1.0;
        targetW = baseW * currentScaleX;
        targetH = baseH * currentScaleY;
        break;
      }
    }

    if (
      (this.selectedGardenObjectKey === 'prop_avora_tree' || this.selectedGardenObjectKey?.includes('tree')) &&
      this.treeContainer
    ) {
      selectedType = 'TREE';
      targetObject = this.treeContainer;
      targetX = this.treeContainer.x;
      baseW = 340;
      baseH = 380;
      currentScaleX = this.treeContainer.scaleX;
      currentScaleY = this.treeContainer.scaleY;
      targetW = baseW * currentScaleX;
      targetH = baseH * currentScaleY;
      targetY = this.treeContainer.y - targetH * 0.42;
    }

    const dec = this.gardenDecorationsMap.get(this.selectedGardenObjectKey);
    if (dec) {
      selectedType = 'DECORATION';
      targetObject = dec.container;
      targetX = dec.container.x;
      baseW = dec.objData.width || 100;
      baseH = dec.objData.height || 80;
      currentScaleX = dec.objData.scaleX || 1.0;
      currentScaleY = dec.objData.scaleY || 1.0;
      targetW = baseW * currentScaleX;
      targetH = baseH * currentScaleY;
      targetY = dec.container.y - targetH * 0.5;
    }

    // 1. Vẽ khung viền chọn Bounding Box Cyan
    this.editorGizmoGraphics.lineStyle(2, 0x06b6d4, 0.95);
    this.editorGizmoGraphics.strokeRect(targetX - targetW / 2, targetY - targetH / 2, targetW, targetH);

    // 2. Khởi tạo & Định vị 4 tay cầm điều chỉnh kích thước góc (Gizmo Resize Handles)
    const halfW = targetW / 2;
    const halfH = targetH / 2;
    const cornerPositions = [
      { x: targetX - halfW, y: targetY - halfH, cursor: 'nwse-resize', signX: -1, signY: -1 }, // TL
      { x: targetX + halfW, y: targetY - halfH, cursor: 'nesw-resize', signX: 1, signY: -1 },  // TR
      { x: targetX - halfW, y: targetY + halfH, cursor: 'nesw-resize', signX: -1, signY: 1 },  // BL
      { x: targetX + halfW, y: targetY + halfH, cursor: 'nwse-resize', signX: 1, signY: 1 },   // BR
    ];

    while (this.editorGizmoHandles.length < 4) {
      const idx = this.editorGizmoHandles.length;
      const handle = this.add
        .rectangle(0, 0, 12, 12, 0xffffff, 1.0)
        .setStrokeStyle(2, 0x06b6d4, 1.0)
        .setDepth(99999)
        .setInteractive({ useHandCursor: true });
      if (handle.input) {
        this.input.setDraggable(handle);
      }

      handle.on('dragstart', () => {
        if (this.cameraControls) {
          this.cameraControls.setInputBlocked(true);
        }
      });

      handle.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (!this.selectedGardenObjectKey || !targetObject) return;
        const corner = cornerPositions[idx];
        const dx = (dragX - targetX) * corner.signX;
        const dy = (dragY - targetY) * corner.signY;

        let newW = Math.max(30, Math.round(dx * 2));
        let newH = Math.max(30, Math.round(dy * 2));

        let newScaleX = newW / baseW;
        let newScaleY = newH / baseH;

        if (this.isGizmoAspectLocked) {
          const uniformScale = Math.max(0.15, Math.min(4.0, (newScaleX + newScaleY) / 2));
          newScaleX = uniformScale;
          newScaleY = uniformScale;
          newW = Math.round(baseW * uniformScale);
          newH = Math.round(baseH * uniformScale);
        }

        // Cập nhật scale đối tượng trực tiếp trong Canvas
        targetObject.setScale(newScaleX, newScaleY);

        if (selectedType === 'PLOT' && plotIdx !== undefined) {
          const plotItem = this.plotItems.get(plotIdx);
          if (plotItem) {
            plotItem.data.scaleX = newScaleX;
            plotItem.data.scaleY = newScaleY;
            plotItem.data.width = newW;
            plotItem.data.height = newH;
          }
        } else if (selectedType === 'DECORATION' && dec) {
          dec.objData.scaleX = newScaleX;
          dec.objData.scaleY = newScaleY;
          dec.objData.width = newW;
          dec.objData.height = newH;
        }

        this.drawEditorSelectionGizmo();

        farmEventBus.emit('GARDEN_OBJECT_RESIZING', {
          objectKey: this.selectedGardenObjectKey,
          width: newW,
          height: newH,
          scaleX: Number(newScaleX.toFixed(3)),
          scaleY: Number(newScaleY.toFixed(3)),
        });
      });

      handle.on('dragend', () => {
        if (this.cameraControls) {
          this.cameraControls.setInputBlocked(false);
        }
        if (!this.selectedGardenObjectKey || !targetObject) return;
        const finalScaleX = targetObject.scaleX;
        const finalScaleY = targetObject.scaleY;
        const finalW = Math.round(baseW * finalScaleX);
        const finalH = Math.round(baseH * finalScaleY);

        farmEventBus.emit('GARDEN_OBJECT_RESIZED', {
          objectKey: this.selectedGardenObjectKey,
          width: finalW,
          height: finalH,
          scaleX: Number(finalScaleX.toFixed(3)),
          scaleY: Number(finalScaleY.toFixed(3)),
        });
      });

      this.editorGizmoHandles.push(handle);
    }

    // Định vị 4 tay cầm tại 4 góc
    for (let i = 0; i < 4; i++) {
      const handle = this.editorGizmoHandles[i];
      const pos = cornerPositions[i];
      handle.setPosition(pos.x, pos.y);
      handle.setVisible(true);
    }
  }

  /**
   * Đồng bộ số lượng bao lì xì may mắn treo trên Cây Thần
   */
  public syncLuckyEnvelopes(ticketCount: number, maxVisible: number = 8) {
    this.luckyEnvelopeTicketCount = Math.max(0, ticketCount);
    this.maxVisibleEnvelopes = maxVisible;
    this.renderLuckyEnvelopes();
  }

  private clearLuckyEnvelopes() {
    this.luckyEnvelopeItems.forEach((item) => {
      item.glow?.destroy();
      item.badge?.destroy();
      item.sprite.destroy();
    });
    this.luckyEnvelopeItems = [];
  }

  private renderLuckyEnvelopes() {
    this.clearLuckyEnvelopes();
    if (!this.treeContainer || !this.treeContainer.active || this.luckyEnvelopeTicketCount <= 0) {
      return;
    }

    const count = Math.min(this.luckyEnvelopeTicketCount, this.maxVisibleEnvelopes);
    const overflow = Math.max(0, this.luckyEnvelopeTicketCount - this.maxVisibleEnvelopes);

    const targetParent = this.canopyContainer || this.treeContainer;
    const juncY = this.canopyContainer ? this.canopyContainer.y : 0;

    const treeScaleRatio = FarmWorldLayoutConfig.AVORA_TREE_SCALE / 0.38;
    for (let i = 0; i < count; i++) {
      const anchor = TREE_ENVELOPE_ANCHORS[i % TREE_ENVELOPE_ANCHORS.length];
      const posX = Math.round(anchor.dx * treeScaleRatio);
      // Tọa độ cục bộ trong canopyContainer (hoặc treeContainer nếu canopyContainer chưa sẵn sàng)
      const posY = this.canopyContainer
        ? Math.round(anchor.dy * treeScaleRatio) - juncY
        : Math.round(anchor.dy * treeScaleRatio);

      // Glow hoàng kim mềm mại phía sau bao lì xì
      const glow = this.add.graphics();
      glow.fillStyle(0xf59e0b, 0.35);
      glow.fillCircle(0, 0, Math.round(18 * FarmWorldLayoutConfig.RED_ENVELOPE_SCALE));
      glow.setPosition(posX, posY + Math.round(22 * FarmWorldLayoutConfig.RED_ENVELOPE_SCALE));

      this.tweens.add({
        targets: glow,
        alpha: { from: 0.15, to: 0.55 },
        scaleX: { from: 0.85, to: 1.25 },
        scaleY: { from: 0.85, to: 1.25 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: anchor.delay,
      });

      // Sprite Bao Lì Xì (Treo từ cành cây)
      const targetW = Math.round(36 * (anchor.scale / 0.28) * FarmWorldLayoutConfig.RED_ENVELOPE_SCALE);
      const targetH = Math.round(54 * (anchor.scale / 0.28) * FarmWorldLayoutConfig.RED_ENVELOPE_SCALE);
      const sprite = this.add
        .image(posX, posY, FARM_ASSET_KEYS.PROPS.LUCKY_ENVELOPE)
        .setOrigin(0.5, 0.05);
      sprite.setDisplaySize(targetW, targetH);

      // Hit area chuẩn xác và hỗ trợ tap nhạy trên mobile
      const padX = sprite.width * 0.25;
      const padY = sprite.height * 0.25;
      sprite.setInteractive(
        new Phaser.Geom.Rectangle(-padX, -padY, sprite.width + padX * 2, sprite.height + padY * 2),
        Phaser.Geom.Rectangle.Contains
      );

      sprite.input?.cursor && (sprite.input.cursor = 'pointer');

      // Hover feedback lấp lánh
      sprite.on('pointerover', () => {
        if (this.isWorldInputBlocked) return;
        sprite.setTint(0xfff59d);
      });
      sprite.on('pointerout', () => {
        sprite.clearTint();
      });

      // Animation lắc lư độc lập của từng bao lì xì trên cành (KHÔNG làm thân hay gốc cây rung theo!)
      this.tweens.add({
        targets: sprite,
        angle: { from: -anchor.swayAngle, to: anchor.swayAngle },
        duration: anchor.duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: anchor.delay,
      });

      // Badge +N hiển thị trên bao cuối nếu số lượt vượt quá 8 bao
      let badge: Phaser.GameObjects.Container | undefined;
      if (i === count - 1 && overflow > 0) {
        badge = this.add.container(
          posX + Math.round(16 * FarmWorldLayoutConfig.RED_ENVELOPE_SCALE),
          posY + Math.round(8 * FarmWorldLayoutConfig.RED_ENVELOPE_SCALE)
        );

        const badgeBg = this.add.graphics();
        badgeBg.fillStyle(0xb91c1c, 0.95);
        badgeBg.lineStyle(1.5, 0xfde047, 1);
        badgeBg.fillRoundedRect(-14, -9, 28, 18, 9);
        badgeBg.strokeRoundedRect(-14, -9, 28, 18, 9);

        const badgeText = this.add.text(0, 0, `+${overflow}`, {
          fontSize: '10px',
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5);

        badge.add([badgeBg, badgeText]);

        this.tweens.add({
          targets: badge,
          y: '+=2',
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        targetParent.add(badge);
      }

      // Xử lý Click / Tap mở lì xì an toàn
      this.bindSafeTap(sprite, () => {
        this.handleTapLuckyEnvelope(sprite, i);
      });

      targetParent.add([glow, sprite]);

      this.luckyEnvelopeItems.push({
        sprite,
        glow,
        badge,
      });
    }
  }

  private handleTapLuckyEnvelope(sprite: Phaser.GameObjects.Image, index: number) {
    if (this.isWorldInputBlocked) return;

    // Hiệu ứng rung lắc & tỏa sáng rực rỡ khi chạm mở
    this.tweens.add({
      targets: sprite,
      angle: { from: -12, to: 12 },
      scale: sprite.scale * 1.18,
      duration: 65,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        // Hạt pháo hoa / ánh sao vàng nổ bung
        this.emitEnvelopeSparkles(sprite.x, sprite.y + 20);
        // Phát sự kiện lên React để gọi Backend mở thưởng
        farmEventBus.emit('OPEN_LUCKY_ENVELOPE');
      },
    });
  }

  private emitEnvelopeSparkles(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const speed = Phaser.Math.Between(40, 90);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const sparkle = this.add.graphics();
      sparkle.fillStyle(0xfde047, 0.95);
      sparkle.fillCircle(0, 0, Phaser.Math.Between(2, 4));
      sparkle.setPosition(x, y);
      sparkle.setDepth(this.avoraTreeSprite ? this.avoraTreeSprite.depth + 10 : 250);

      this.tweens.add({
        targets: sparkle,
        x: x + vx * 0.4,
        y: y + vy * 0.4,
        alpha: 0,
        scale: 0.2,
        duration: 550,
        ease: 'Cubic.easeOut',
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  private lastFpsSampleTime = 0;
  private lastStageCheckTime = 0;

  update(time: number) {
    if (time - this.lastFpsSampleTime > 1000) {
      this.lastFpsSampleTime = time;
      if (this.game?.loop) {
        qualityManager.sampleFPS(this.game.loop.actualFps);
      }
    }

    if (time - this.lastStageCheckTime > 1000) {
      this.lastStageCheckTime = time;
      this.checkRealtimeCropGrowth();
    }
  }

  /**
   * Cập nhật thời gian thực (Real-time) các giai đoạn sinh trưởng (stage) của cây
   * Giúp cây tự động nhảy vọt từ Hạt -> Mầm -> Lớn -> Chín mà KHÔNG CẦN F5 tải lại trang
   */
  private checkRealtimeCropGrowth() {
    if (this.isVisitMode || this.plotItems.size === 0) return;

    const now = Date.now();

    this.plotItems.forEach((item, plotIndex) => {
      const plot = item.data;
      if (!plot || plot.status === 'LOCKED' || !plot.cropInstance || !plot.cropInstance.crop) {
        return;
      }

      const cropInst = plot.cropInstance;
      const readyAt = cropInst.readyAt ? new Date(cropInst.readyAt).getTime() : 0;
      const stage3At = cropInst.stage3At ? new Date(cropInst.stage3At).getTime() : 0;
      const stage2At = cropInst.stage2At ? new Date(cropInst.stage2At).getTime() : 0;
      const stage1At = cropInst.stage1At ? new Date(cropInst.stage1At).getTime() : 0;
      const plantedAt = cropInst.plantedAt ? new Date(cropInst.plantedAt).getTime() : 0;

      let currentStage = 0;
      let isReady = false;

      if (readyAt > 0 && now >= readyAt) {
        currentStage = 5;
        isReady = true;
      } else if (stage3At > 0 && now >= stage3At) {
        currentStage = 4;
      } else if (stage2At > 0 && now >= stage2At) {
        currentStage = 3;
      } else if (stage1At > 0 && now >= stage1At) {
        currentStage = 2;
      } else if (plantedAt > 0 && now >= plantedAt) {
        currentStage = 1;
      }

      const prevStage = item.currentRenderedStage ?? (plot.growthState?.stage ?? 0);

      if (currentStage !== prevStage) {
        item.currentRenderedStage = currentStage;
        if (!plot.growthState) {
          plot.growthState = {};
        }
        plot.growthState.stage = currentStage;
        plot.growthState.isReady = isReady;

        if (isReady) {
          plot.isReady = true;
          plot.status = 'READY';
          this.applyPlotTileMetrics(item.tileSprite, FARM_ASSET_KEYS.PLOTS.READY_GLOW);
        }

        this.updateCropVisualForStage(item, currentStage, isReady);

        farmEventBus.emit('PLOT_GROWTH_STAGE_CHANGED', {
          plotIndex,
          newStage: currentStage,
          isReady,
        });
      }
    });
  }

  /**
   * Cập nhật diện mạo visual của cây trồng khi lên stage mới
   * Kèm hiệu ứng nảy mầm vui nhộn (pop tween) và bụi sao tăng trưởng
   */
  private updateCropVisualForStage(item: PlotEntity, _stage: number, isReady: boolean) {
    const plot = item.data;
    if (!plot?.cropInstance?.crop) return;

    this.syncPlotsState([plot]);
    this.emitGrowthParticles(0, -15, isReady);
  }

  private emitGrowthParticles(x: number, y: number, isRipe: boolean) {
    const particleColor = isRipe ? 0xfacc15 : 0x4ade80;
    for (let i = 0; i < 8; i++) {
      const p = this.add.circle(
        x + (Math.random() * 26 - 13),
        y + (Math.random() * 14 - 7),
        2 + Math.random() * 2,
        particleColor,
        0.85
      );
      p.setDepth(this.grid.calculateDepth(y, 35));

      this.tweens.add({
        targets: p,
        y: p.y - 25 - Math.random() * 15,
        alpha: 0,
        scale: 0.2,
        duration: 500 + Math.random() * 200,
        ease: 'Sine.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }
}
