/**
 * FarmWorldLayoutConfig.ts
 * Bố cục Hình học Không gian Toàn Thế Giới AVORA Farm (Centralized Isometric Layout).
 * Định nghĩa Tọa độ Gốc, Safe Playable Area, Cliff Exclusion Zone, và Anchor các Đạo cụ.
 */

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PropAnchorConfig {
  key: string;
  gridRow?: number;
  gridCol?: number;
  worldX?: number;
  worldY?: number;
  offsetX?: number;
  offsetY?: number;
  originX?: number;
  originY?: number;
  scale?: number;
  depthOffset?: number;
}

// =========================================================================
// BIẾN CẤU HÌNH TẬP TRUNG TOÀN CỤC THEO YÊU CẦU NÂNG CẤP BỐ CỤC
// =========================================================================
export const PLOT_SCALE = 3.0;        // Tăng đúng x2 kích thước hiển thị thực tế của mỗi ô đất (132px -> 264px)
export const CROP_SCALE = 2.8;        // Tăng đúng x2 kích thước cây trồng (113.5px -> 227px khi chín)
export const AVORA_TREE_SCALE = 0.532; // Tăng đúng x1.4 kích thước Cây Thần AVORA (0.38 * 1.4 = 0.532)
export const RED_ENVELOPE_SCALE = 1.4;// Tỷ lệ bao lì xì bám cành Cây Thần đồng bộ 1.4x

export const FarmWorldLayoutConfig = {
  // Biến cấu hình tập trung
  PLOT_SCALE,
  CROP_SCALE,
  AVORA_TREE_SCALE,
  RED_ENVELOPE_SCALE,

  PLOT_RENDER_SCALE: PLOT_SCALE,
  BASE_PLOT_DISPLAY_WIDTH: 88,
  BASE_PLOT_DISPLAY_HEIGHT: 56,

  // Kích thước hiển thị thực tế của từng ô đất: Tăng đúng x2 (132x84 -> 264x168)
  TARGET_PLOT_DISPLAY_WIDTH: Math.round(88 * PLOT_SCALE),   // 264px (chuẩn 200% so với 132px)
  TARGET_PLOT_DISPLAY_HEIGHT: Math.round(56 * PLOT_SCALE),  // 168px (chuẩn 200% so với 84px)

  // Rãnh giữa các ô đất: Mở rộng rõ rệt, khe hở thực tế giữa các mép tile đạt 15-22px
  PLOT_GAP: 40,
  TILE_WIDTH: 304,  // Bước nhảy lưới ngang (264px + 40px = 304px)
  TILE_HEIGHT: 156,  // Bước nhảy lưới dọc đo lường theo góc nghiêng texture thực tế
  GRID_SIZE: 5,     // 5x5 = 25 Plots

  // 1. Tọa độ gốc trung tâm lưới 5x5: Đặt cụm ô đất 264px cân đối vững chãi trên mặt bằng đảo
  GRID_ORIGIN_X: -280,
  GRID_ORIGIN_Y: -35,

  // 2. Vùng đất trồng trọt & tương tác an toàn (ISLAND_PLAYABLE_SAFE_AREA)
  PLAYABLE_SAFE_AREA: {
    minX: -1080,
    maxX: 480,
    minY: -100,
    maxY: 750,
  } as BoundingBox,

  // 3. Vùng cấm mép vực & hồ thác nước (CLIFF_EXCLUSION_ZONE)
  CLIFF_EXCLUSION: {
    cliffBottomEdgeY: 850,
    waterfallLeftEdgeX: 420,
    cliffLeftEdgeX: -1100,
  },

  // 4. Cấu hình Camera trung tâm (căn chỉnh theo bố cục 2.0x mới)
  CAMERA: {
    DEFAULT_CENTER_X: -180,
    DEFAULT_CENTER_Y: 220,
    DEFAULT_ZOOM: 0.82,
    MIN_ZOOM: 0.40,
    MAX_ZOOM: 1.85,
  },

  // 5. Vị trí Cây Thần AVORA: Phóng to x1.4, dịch lên trên và sang phải để mở rộng diện tích cho ô đất
  PROPS_ANCHORS: [
    {
      key: 'prop_avora_tree',
      worldX: 310, // Dịch sang phải (từ 245 -> 310)
      worldY: 60,  // Dịch lên trên (từ 125 -> 60)
      originX: 0.5,
      originY: 0.98,
      scale: AVORA_TREE_SCALE,
      depthOffset: 120,
    },
  ] as PropAnchorConfig[],

  // 6. Lối đi bằng đá
  STONE_PATH_COORDS: [] as Array<{ r: number; c: number }>,

  // 7. Thác nước sống động (Waterfall streams & pond)
  WATERFALL: {
    originX: 305,
    streamTopY: 255,
    pondY: 375,
  },
};

/**
 * Kiểm tra tính hợp lệ của tọa độ so với Safe Playable Area & Cliff Exclusion
 */
export function validateWorldPointInSafeArea(x: number, y: number, label = 'Object'): boolean {
  const { PLAYABLE_SAFE_AREA, CLIFF_EXCLUSION } = FarmWorldLayoutConfig;

  let isSafe = true;
  if (x < PLAYABLE_SAFE_AREA.minX || x > PLAYABLE_SAFE_AREA.maxX) isSafe = false;
  if (y < PLAYABLE_SAFE_AREA.minY || y > PLAYABLE_SAFE_AREA.maxY) isSafe = false;

  if (y > CLIFF_EXCLUSION.cliffBottomEdgeY) isSafe = false;
  if (x > CLIFF_EXCLUSION.waterfallLeftEdgeX && y > 250) isSafe = false;

  if (!isSafe && process.env.NODE_ENV !== 'production') {
    console.warn(`[FarmLayout] ⚠️ ${label} at (${x.toFixed(1)}, ${y.toFixed(1)}) is OUTSIDE SAFE PLAYABLE AREA!`);
  }

  return isSafe;
}
