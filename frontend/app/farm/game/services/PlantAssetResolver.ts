/**
 * PlantAssetResolver.ts
 * BỘ ĐIỀU PHỐI VÀ TRA CỨU ASSET CÂY TRỒNG TẬP TRUNG CHO AVORA FARM
 *
 * Nhiệm vụ:
 * 1. Định tuyến asset theo chuẩn Production: AVIF (Ưu tiên) -> WebP (Fallback) -> PNG (Legacy)
 * 2. Cung cấp metadata hiển thị: renderScale, renderOffsetX, renderOffsetY, anchorX, anchorY
 * 3. Hỗ trợ Cache Busting (?v=version/timestamp) khi Admin thay ảnh
 * 4. Tự động đồng bộ với dữ liệu quản trị từ Backend (Prisma FarmPlantAsset)
 * 5. Ngăn ngừa hoàn toàn missing image và lỗi vỡ bố cục
 */

export interface PlantAssetDescriptor {
  cropCode: string;
  stage?: number;
  mutationCode?: string;
  name: string;
  avifUrl: string;
  webpUrl: string;
  fallbackUrl: string;
  renderScale: number;
  renderOffsetX: number;
  renderOffsetY: number;
  anchorX: number;
  anchorY: number;
  width?: number;
  height?: number;
  version?: number | string;
}

// Thư mục chuẩn của từng loại cây trong 15 giống cây
const CROP_FOLDER_MAP: Record<string, string> = {
  JAPANESE_RICE: 'rice',
  RICE: 'rice',
  STRAWBERRY: 'strawberry',
  GRAPE: 'grape',
  MATCHA: 'matcha',
  MATCHA_LEAF: 'matcha',
  SAKURA: 'sakura',
  SAKURA_PEARL: 'sakura',
  YUZU: 'yuzu',
  CORN: 'corn',
  SUNFLOWER: 'sunflower',
  TOMATO: 'tomato',
  TUNA_CORAL: 'ocean-coral',
  SALMON_BLOSSOM: 'salmon-anise',
  PEACH: 'peach',
  WASABI: 'wasabi',
  SHISO: 'perilla',
  WASABI_CRYSTAL: 'wasabi',
};

// Metadata căn chỉnh gốc cây (anchor & scale) mặc định: footY = 1.0 để giữ nguyên 100% phần gốc, rễ, mô đất
const CROP_DEFAULT_METRICS: Record<string, { scale: number; offsetX: number; offsetY: number; footX: number; footY: number }> = {
  rice: { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  strawberry: { scale: 0.95, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  grape: { scale: 1.02, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  matcha: { scale: 0.94, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  sakura: { scale: 1.06, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  yuzu: { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  corn: { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  sunflower: { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  tomato: { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  'ocean-coral': { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  'salmon-anise': { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  wasabi: { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  perilla: { scale: 1.0, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
  peach: { scale: 0.95, offsetX: 0, offsetY: 0, footX: 0.5, footY: 1.0 },
};

// Bộ nhớ đệm động các cấu hình ghi đè từ Admin Database
let dynamicAssetOverrides: Map<string, Partial<PlantAssetDescriptor>> = new Map();

/**
 * Cập nhật cấu hình asset động từ Admin API
 */
export function setDynamicAssetOverrides(assets: any[]) {
  if (!Array.isArray(assets)) return;
  const newMap = new Map<string, Partial<PlantAssetDescriptor>>();
  assets.forEach((a) => {
    const key = a.assetType === 'MUTATION'
      ? `mut_${(a.mutationCode || '').toUpperCase()}`
      : `stage_${(a.cropCode || '').toUpperCase()}_${a.stageIndex ?? 0}`;
    newMap.set(key, {
      avifUrl: a.avifUrl,
      webpUrl: a.webpUrl,
      fallbackUrl: a.fallbackUrl || a.originalUrl,
      renderScale: a.renderScale ?? 1.0,
      renderOffsetX: a.renderOffsetX ?? 0,
      renderOffsetY: a.renderOffsetY ?? 0,
      anchorX: a.anchorX ?? 0.5,
      anchorY: a.anchorY ?? 1.0,
      version: a.version || a.updatedAt,
    });
  });
  dynamicAssetOverrides = newMap;
}

/**
 * Chuẩn hóa mã cây trồng
 */
export function normalizeCropCode(code: string): string {
  const norm = (code || '').toUpperCase().trim();
  if (norm.includes('RICE')) return 'JAPANESE_RICE';
  if (norm.includes('STRAW')) return 'STRAWBERRY';
  if (norm.includes('GRAPE')) return 'GRAPE';
  if (norm.includes('MATCHA')) return 'MATCHA_LEAF';
  if (norm.includes('SAKURA')) return 'SAKURA_PEARL';
  if (norm.includes('YUZU')) return 'YUZU';
  if (norm.includes('CORN') || norm.includes('BAP') || norm.includes('NGO')) return 'CORN';
  if (norm.includes('SUNFLOWER') || norm.includes('HUONG_DUONG')) return 'SUNFLOWER';
  if (norm.includes('TOMATO') || norm.includes('CA_CHUA')) return 'TOMATO';
  if (norm.includes('CORAL') || norm.includes('SAN_HO')) return 'TUNA_CORAL';
  if (norm.includes('SALMON') || norm.includes('HOA_HOI')) return 'SALMON_BLOSSOM';
  if (norm.includes('PEACH') || norm.includes('DAO')) return 'PEACH';
  if (norm.includes('WASABI_CRYSTAL') || norm.includes('PHA_LE_WASABI')) return 'WASABI_CRYSTAL';
  if (norm.includes('WASABI')) return 'WASABI';
  if (norm.includes('SHISO') || norm.includes('PERILLA') || norm.includes('TIA_TO')) return 'SHISO';
  return norm || 'JAPANESE_RICE';
}

/**
 * Gắn query string cache busting
 */
function withVersion(url: string, version?: number | string): string {
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${version}`;
}

/**
 * Tra cứu Asset cho giai đoạn sinh trưởng của cây (Stage 0 - 5)
 */
export function getPlantStageAsset(
  cropCode: string,
  stage: number,
  customVersion?: number | string
): PlantAssetDescriptor {
  const normCode = normalizeCropCode(cropCode);
  const clampedStage = Math.max(0, Math.min(5, Math.floor(stage)));
  const folder = CROP_FOLDER_MAP[normCode] || 'rice';

  const cacheKey = `stage_${normCode}_${clampedStage}`;
  const override = dynamicAssetOverrides.get(cacheKey);

  const baseAvif = override?.avifUrl || `/game/farm/crops/${folder}/stage_${clampedStage}.avif`;
  const baseWebp = override?.webpUrl || `/game/farm/crops/${folder}/stage_${clampedStage}.webp`;
  const basePng = override?.fallbackUrl || `/game/farm/crops/${folder}/stage_${clampedStage}.png`;
  const version = customVersion || override?.version;

  const metrics = CROP_DEFAULT_METRICS[folder] || CROP_DEFAULT_METRICS.rice;

  return {
    cropCode: normCode,
    stage: clampedStage,
    name: `${normCode} Stage ${clampedStage}`,
    avifUrl: withVersion(baseAvif, version),
    webpUrl: withVersion(baseWebp, version),
    fallbackUrl: withVersion(basePng, version),
    renderScale: override?.renderScale ?? metrics.scale,
    renderOffsetX: override?.renderOffsetX ?? metrics.offsetX,
    renderOffsetY: override?.renderOffsetY ?? metrics.offsetY,
    anchorX: override?.anchorX ?? metrics.footX,
    anchorY: override?.anchorY ?? metrics.footY,
    version,
  };
}

/**
 * Tra cứu Asset cho thể đột biến (Mutation)
 */
export function getPlantMutationAsset(
  cropCode: string,
  mutationCode: string,
  customVersion?: number | string
): PlantAssetDescriptor {
  const normCrop = normalizeCropCode(cropCode);
  const normMut = (mutationCode || '').toUpperCase().trim();

  const cacheKey = `mut_${normMut}`;
  const override = dynamicAssetOverrides.get(cacheKey);

  let avifUrl = '';
  let webpUrl = '';
  let fallbackUrl = '';
  let name = mutationCode;
  let renderScale = 1.0;
  let renderOffsetX = 0;
  let renderOffsetY = 0;
  let anchorX = 0.5;
  let anchorY = 0.98;

  // 1. CÂY LÚA (RICE) MUTATIONS
  if (normMut.includes('MOONLIGHT_RICE') || normMut.includes('NGUYET_QUANG')) {
    name = 'Lúa Nguyệt Quang';
    avifUrl = '/game/farm/mutations/rice/lua_nguyet_quang.avif';
    webpUrl = '/game/farm/mutations/rice/lua_nguyet_quang.webp';
    fallbackUrl = '/game/farm/mutations/rice/lua_nguyet_quang.png';
    renderScale = 1.0;
    anchorY = 0.94;
  } else if (normMut.includes('GOLDEN_RICE') || normMut.includes('VANG_24K')) {
    name = 'Lúa Vàng 24K';
    avifUrl = '/game/farm/mutations/rice/lua_vang_24k.avif';
    webpUrl = '/game/farm/mutations/rice/lua_vang_24k.webp';
    fallbackUrl = '/game/farm/mutations/rice/lua_vang_24k.png';
    renderScale = 1.0;
    anchorY = 0.94;
  } else if (normMut.includes('CRYSTAL_RICE') || normMut.includes('THACH_ANH')) {
    name = 'Gạo Thạch Anh Pha Lê';
    avifUrl = '/game/farm/mutations/rice/lua_thach_anh_pha_le.avif';
    webpUrl = '/game/farm/mutations/rice/lua_thach_anh_pha_le.webp';
    fallbackUrl = '/game/farm/mutations/rice/lua_thach_anh_pha_le.png';
    renderScale = 1.0;
    anchorY = 0.94;
  }
  // 2. DÂU TÂY (STRAWBERRY) MUTATIONS
  else if (normMut.includes('CRYSTAL') || normMut.includes('STRAWBERRY') || normMut.includes('PHA_LE') || normMut.includes('DAU_TAY')) {
    name = normMut.includes('MOON') ? 'Dâu Tây Ánh Trăng' : (normMut.includes('QUEEN') ? 'Nữ Hoàng Dâu Sakura' : 'Dâu Tây Pha Lê');
    avifUrl = '/game/farm/mutations/strawberry/dau_tay_pha_le.avif';
    webpUrl = '/game/farm/mutations/strawberry/dau_tay_pha_le.webp';
    fallbackUrl = '/game/farm/mutations/strawberry/dau_tay_pha_le.png';
    anchorY = 0.94;
  }
  // 3. NHO (GRAPE) MUTATIONS
  else if (normMut.includes('RUBY') || normMut.includes('HONG_NGOC')) {
    name = 'Nho Hồng Ngọc Đế Vương';
    avifUrl = '/game/farm/mutations/grape/nho_hong_ngoc_de_vuong.avif';
    webpUrl = '/game/farm/mutations/grape/nho_hong_ngoc_de_vuong.webp';
    fallbackUrl = '/game/farm/mutations/grape/nho_hong_ngoc_de_vuong.png';
    anchorY = 0.94;
  } else if (normMut.includes('JADE') || normMut.includes('NGOC_BICH')) {
    name = 'Nho Ngọc Bích Shizuoka';
    avifUrl = '/game/farm/mutations/grape/nho_ngoc_bich_shizuoka.avif';
    webpUrl = '/game/farm/mutations/grape/nho_ngoc_bich_shizuoka.webp';
    fallbackUrl = '/game/farm/mutations/grape/nho_ngoc_bich_shizuoka.png';
    anchorY = 0.94;
  } else if (normMut.includes('GOLD') || normMut.includes('GRAPE')) {
    name = 'Nho Vàng Hoàng Gia';
    avifUrl = '/game/farm/mutations/grape/nho_vang_hoang_gia.avif';
    webpUrl = '/game/farm/mutations/grape/nho_vang_hoang_gia.webp';
    fallbackUrl = '/game/farm/mutations/grape/nho_vang_hoang_gia.png';
    anchorY = 0.94;
  }
  // 4. MATCHA MUTATIONS
  else if (normMut.includes('MATCHA') || normMut.includes('LUC_BAO') || normMut.includes('EMERALD')) {
    name = 'Trà Lục Bảo Uji';
    avifUrl = '/game/farm/mutations/matcha/tra_luc_bao_uji.avif';
    webpUrl = '/game/farm/mutations/matcha/tra_luc_bao_uji.webp';
    fallbackUrl = '/game/farm/mutations/matcha/tra_luc_bao_uji.png';
    anchorY = 0.94;
  }
  // 5. HOA ANH ĐÀO (SAKURA / PEARL) MUTATIONS
  else if (normMut.includes('SAKURA') || normMut.includes('MOON') || normMut.includes('PEARL')) {
    name = 'Ngọc Trai Nguyệt Hoa';
    avifUrl = '/game/farm/mutations/sakura/anh_dao_anh_trang.avif';
    webpUrl = '/game/farm/mutations/sakura/anh_dao_anh_trang.webp';
    fallbackUrl = '/game/farm/mutations/sakura/anh_dao_anh_trang.png';
    anchorY = 0.94;
  }
  // 6. YUZU MUTATIONS
  else if (normMut.includes('YUZU') || normMut.includes('CHANH') || normMut.includes('SOLAR')) {
    name = 'Chanh Thái Dương Quang';
    avifUrl = '/game/farm/mutations/yuzu/chanh_thai_duong.avif';
    webpUrl = '/game/farm/mutations/yuzu/chanh_thai_duong.webp';
    fallbackUrl = '/game/farm/mutations/yuzu/chanh_thai_duong.png';
    anchorY = 0.94;
  }
  // 7. TOMATO MUTATIONS
  else if (normMut.includes('TOMATO') || normMut.includes('CA_CHUA')) {
    name = 'Cà Chua Hoàng Kim';
    avifUrl = '/game/farm/mutations/tomato/ca_chua_hoang_kim.avif';
    webpUrl = '/game/farm/mutations/tomato/ca_chua_hoang_kim.webp';
    fallbackUrl = '/game/farm/mutations/tomato/ca_chua_hoang_kim.png';
    anchorY = 0.94;
  }
  // 8. CORN MUTATIONS
  else if (normMut.includes('CORN') || normMut.includes('BAP') || normMut.includes('NGO')) {
    name = 'Bắp Ngô Hoàng Kim';
    avifUrl = '/game/farm/mutations/corn/bap_hoang_kim.avif';
    webpUrl = '/game/farm/mutations/corn/bap_hoang_kim.webp';
    fallbackUrl = '/game/farm/mutations/corn/bap_hoang_kim.png';
    anchorY = 0.94;
  }
  // FALLBACK MẶC ĐỊNH SANG STAGE 5 CỦA CÂY ĐÓ
  else {
    const stage5 = getPlantStageAsset(normCrop, 5, customVersion);
    return stage5;
  }

  // Áp dụng override từ Admin nếu có
  if (override) {
    if (override.avifUrl) avifUrl = override.avifUrl;
    if (override.webpUrl) webpUrl = override.webpUrl;
    if (override.fallbackUrl) fallbackUrl = override.fallbackUrl;
    if (override.renderScale !== undefined) renderScale = override.renderScale;
    if (override.renderOffsetX !== undefined) renderOffsetX = override.renderOffsetX;
    if (override.renderOffsetY !== undefined) renderOffsetY = override.renderOffsetY;
    if (override.anchorX !== undefined) anchorX = override.anchorX;
    if (override.anchorY !== undefined) anchorY = override.anchorY;
  }

  const version = customVersion || override?.version;

  return {
    cropCode: normCrop,
    mutationCode: normMut,
    name,
    avifUrl: withVersion(avifUrl, version),
    webpUrl: withVersion(webpUrl, version),
    fallbackUrl: withVersion(fallbackUrl, version),
    renderScale,
    renderOffsetX,
    renderOffsetY,
    anchorX,
    anchorY,
    version,
  };
}

/**
 * Tự động chọn URL tối ưu theo format yêu cầu
 */
export function getPlantAssetUrl(
  cropCode: string,
  stageOrMutation: number | string,
  format: 'avif' | 'webp' | 'png' = 'avif',
  version?: number | string
): string {
  const desc = typeof stageOrMutation === 'number'
    ? getPlantStageAsset(cropCode, stageOrMutation, version)
    : getPlantMutationAsset(cropCode, stageOrMutation, version);

  if (format === 'avif') return desc.avifUrl;
  if (format === 'webp') return desc.webpUrl;
  return desc.fallbackUrl;
}
