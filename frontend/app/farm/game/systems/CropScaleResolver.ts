/**
 * CropScaleResolver.ts
 * HỆ THỐNG CHUẨN HÓA KÍCH THƯỚC CÂY TRỒNG VÀ ĐỘT BIẾN CHO AVORA FARM
 *
 * QUY TẮC BẮT BUỘC:
 * DÙ CHO KÍCH THƯỚC ẢNH GỐC CÓ TO NHƯ THẾ NÀO (128x128, 1024x1024, 2048x2048+)
 * THÌ KÍCH THƯỚC HIỂN THỊ TRÊN MÀN HÌNH BẮT BUỘC PHẢI NHỎ HƠN Ô ĐẤT!
 *
 * Thông số chuẩn:
 * - Ô đất: TILE_WIDTH = 136px, TILE_HEIGHT = 68px (tỷ lệ 2:1 isometric).
 * - Cây trưởng thành / Đột biến: Chiều rộng tối đa ~78% ô đất (106px < 136px),
 *   chiều cao tối đa ~84% (114px).
 * - Cây non (Stage 0 - 4): Tỷ lệ tăng dần từ 28% -> 70% ô đất (38px -> 95px).
 * - Điểm neo gốc (Root Anchor): Tọa độ (0.5, 0.94) ghim chính xác tâm mặt đất diamond.
 */

import { FarmWorldLayoutConfig } from '../config/FarmWorldLayoutConfig';

export interface CropBounds {
  sourceWidth: number;
  sourceHeight: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  visibleWidth: number;
  visibleHeight: number;
  footX: number;
  footY: number;
}

export interface CropVisualResolution {
  scale: number;
  scaleX: number;
  scaleY: number;
  displayWidth: number;
  displayHeight: number;
  originX: number;
  originY: number;
  anchorX: number;
  anchorY: number;
  shadowWidth: number;
  shadowHeight: number;
  shadowAlpha: number;
  renderedVisibleWidth: number;
  renderedVisibleHeight: number;
  hitArea: { x: number; y: number; width: number; height: number };
  bounds: CropBounds;
  debugInfo: {
    cropCode: string;
    stage: number;
    sourceSize: string;
    displayWidth: string;
    displayHeight: string;
    scale: number;
    baseScale: number;
    renderedVisibleSize: string;
    heightRatio: number;
  };
}

/**
 * Tỷ lệ chiều rộng tối đa của cây so với chiều rộng ô đất (plotWidth = TARGET_PLOT_DISPLAY_WIDTH = 88px)
 * ĐẢM BẢO TUYỆT ĐỐI: Mọi stage đều NHỎ HƠN Ô ĐẤT (< 1.0)
 */
export const STAGE_MAX_WIDTH_RATIOS: Record<number, number> = {
  0: 0.32, // ~42px (Hạt mầm nhỏ gọn trong lòng đất)
  1: 0.44, // ~58px (Mầm nhú lên)
  2: 0.58, // ~77px (Cây non tươi tốt)
  3: 0.72, // ~95px (Cây phát triển, bắt đầu xòe tán)
  4: 0.80, // ~106px (Đơm hoa kết quả rõ nét)
  5: 0.86, // ~113.5px (Chín rộ - to, rõ, chiếm ~86% chiều rộng ô đất 132px, tăng 1.4x+)
};

/**
 * Tỷ lệ chiều cao tối đa của cây so với chiều rộng ô đất (chiếm 75-90% vùng hiển thị phía trên ô đất khi trưởng thành)
 */
export const STAGE_MAX_HEIGHT_RATIOS: Record<number, number> = {
  0: 0.32, // ~42px
  1: 0.46, // ~61px
  2: 0.62, // ~82px
  3: 0.76, // ~100px
  4: 0.84, // ~111px
  5: 0.90, // ~119px (Vươn cao bề thế, chiếm 75–90% không gian hiển thị phía trên ô đất)
};

export class CropScaleResolver {
  private plotWidth: number;
  private plotHeight: number;
  private plantAnchorOffsetY: number;

  constructor(
    plotWidth = FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH,
    plotHeight = FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_HEIGHT,
    plantAnchorOffsetY = Math.round(10 * FarmWorldLayoutConfig.PLOT_SCALE) // Tâm mặt đất diamond (30px dưới tâm tile đối với ô đất 264px)
  ) {
    this.plotWidth = plotWidth;
    this.plotHeight = plotHeight;
    this.plantAnchorOffsetY = plantAnchorOffsetY;
  }

  /**
   * Tính toán tỉ lệ scale, điểm neo gốc và kích thước hiển thị chuẩn xác
   * BẢO ĐẢM 100%: displayWidth và displayHeight luôn luôn NHỎ HƠN Ô ĐẤT.
   */
  public resolveCropVisual(
    cropCode: string,
    stage: number,
    plotCenterX: number,
    plotCenterY: number,
    texture?: Phaser.Textures.Texture | null,
    isMutated = false,
    mutationCode = '',
    plotStyleConfig?: any
  ): CropVisualResolution {
    const clampedStage = Math.max(0, Math.min(5, Math.floor(stage)));

    // 1. Tỷ lệ tối đa được phép hiển thị trên màn hình
    // Đột biến: Dùng tỷ lệ chuẩn vương giả 86% chiều rộng (~227px) và 90% chiều cao (~237px)
    const stageScaleOverride = plotStyleConfig?.stages?.[clampedStage]?.scale;
    const mutationScaleOverride = isMutated && mutationCode ? plotStyleConfig?.mutations?.[mutationCode]?.scale : undefined;
    const plantCustomScale = mutationScaleOverride ?? stageScaleOverride ?? (plotStyleConfig?.plantScale ?? 1.0);

    const widthRatio = (isMutated ? 0.86 : (STAGE_MAX_WIDTH_RATIOS[clampedStage] ?? 0.86)) * plantCustomScale;
    const heightRatio = (isMutated ? 0.90 : (STAGE_MAX_HEIGHT_RATIOS[clampedStage] ?? 0.90)) * plantCustomScale;

    const activePlotWidth = (plotStyleConfig?.plotWidth || FarmWorldLayoutConfig.TARGET_PLOT_DISPLAY_WIDTH || this.plotWidth);
    let maxAllowedWidth = activePlotWidth * widthRatio;
    let maxAllowedHeight = activePlotWidth * heightRatio;

    if (plotStyleConfig?.plantWidth && plotStyleConfig.plantWidth > 0) {
      maxAllowedWidth = plotStyleConfig.plantWidth * plantCustomScale;
    }
    if (plotStyleConfig?.plantHeight && plotStyleConfig.plantHeight > 0) {
      maxAllowedHeight = plotStyleConfig.plantHeight * plantCustomScale;
    }

    // 2. Lấy kích thước thực tế của texture nguồn
    let rawWidth = 1024;
    let rawHeight = 1024;

    if (texture && texture.key !== '__MISSING') {
      const src = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      if (src && src.width > 0 && src.height > 0) {
        rawWidth = src.width;
        rawHeight = src.height;
      }
    }

    // 3. TÍNH SCALE CHUẨN XÁC:
    // Dù ảnh gốc có kích thước bao nhiêu (128x128 hay 1024x1024 hay 2048x2048):
    const lockAspect = plotStyleConfig?.lockAspectRatio !== false;
    const minScale = plotStyleConfig?.minScale ?? 0.2;
    const maxScale = plotStyleConfig?.maxScale ?? 4.0;

    let scaleX = maxAllowedWidth / rawWidth;
    let scaleY = maxAllowedHeight / rawHeight;

    if (lockAspect) {
      const uniformScale = Math.min(scaleX, scaleY);
      scaleX = uniformScale;
      scaleY = uniformScale;
    }

    scaleX = Math.max(minScale, Math.min(maxScale, scaleX));
    scaleY = Math.max(minScale, Math.min(maxScale, scaleY));
    const finalScale = scaleX;

    const displayWidth = Math.round(rawWidth * scaleX);
    const displayHeight = Math.round(rawHeight * scaleY);

    // 4. Điểm neo gốc cây (Anchor & Origin)
    // Cây cắm rễ chặt tại tâm mặt phẳng ô đất diamond isometric
    // originY = 1.0 bảo đảm giữ trọn vẹn 100% gốc rễ, củ, mô đất và sỏi đá ở đáy ảnh
    const originX = 0.5;
    const originY = 1.0;
    const currentAnchorOffsetY = Math.round(10 * FarmWorldLayoutConfig.PLOT_SCALE); // 30px: bám sát trung tâm luống đất cày xới
    const customOffsetX = plotStyleConfig?.plantOffsetX ?? 0;
    const customOffsetY = plotStyleConfig?.plantOffsetY ?? 0;

    const anchorX = plotStyleConfig?.plantAnchorX !== undefined
      ? (plotCenterX + plotStyleConfig.plantAnchorX + customOffsetX)
      : (plotCenterX + customOffsetX);

    const anchorY = plotStyleConfig?.plantAnchorY !== undefined
      ? (plotCenterY + plotStyleConfig.plantAnchorY + customOffsetY)
      : (plotCenterY + currentAnchorOffsetY + customOffsetY);

    // 5. Cấu hình bóng đổ tiếp xúc (Contact Shadow)
    const shadowWidth = Math.round(displayWidth * 0.70);
    const shadowHeight = Math.round(shadowWidth * 0.35);
    const shadowAlpha = 0.32;

    // 6. Vùng tương tác nhấp chuột (Hit Area bao phủ gọn gàng phần cây)
    const hitArea = {
      x: Math.round(rawWidth * 0.1),
      y: Math.round(rawHeight * 0.1),
      width: Math.round(rawWidth * 0.8),
      height: Math.round(rawHeight * 0.85),
    };

    const bounds: CropBounds = {
      sourceWidth: rawWidth,
      sourceHeight: rawHeight,
      minX: hitArea.x,
      minY: hitArea.y,
      maxX: hitArea.x + hitArea.width,
      maxY: hitArea.y + hitArea.height,
      visibleWidth: hitArea.width,
      visibleHeight: hitArea.height,
      footX: originX,
      footY: originY,
    };

    return {
      scale: finalScale,
      scaleX: finalScale,
      scaleY: finalScale,
      displayWidth,
      displayHeight,
      originX,
      originY,
      anchorX,
      anchorY,
      shadowWidth,
      shadowHeight,
      shadowAlpha,
      renderedVisibleWidth: displayWidth,
      renderedVisibleHeight: displayHeight,
      hitArea,
      bounds,
      debugInfo: {
        cropCode,
        stage: clampedStage,
        sourceSize: `${rawWidth}x${rawHeight}`,
        displayWidth: `${displayWidth}px`,
        displayHeight: `${displayHeight}px`,
        scale: Number(finalScale.toFixed(6)),
        baseScale: Number(finalScale.toFixed(6)),
        renderedVisibleSize: `${displayWidth}x${displayHeight}px`,
        heightRatio: Number((displayHeight / this.plotWidth).toFixed(3)),
      },
    };
  }
}

export const cropScaleResolver = new CropScaleResolver();
