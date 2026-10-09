/**
 * AVORA FARM - TYPE-SAFE ASSET REGISTRY
 * All texture keys and path manifests for 2.5D Isometric World
 */

export const FARM_ASSET_KEYS = {
  // Environment & Scenery
  ENVIRONMENT: {
    SKY_DAYLIGHT: 'env_sky_daylight',
  },
  // Terrain & Plots
  TERRAIN: {
    ISLAND_CLIFF: 'terrain_island_cliff',
    GRASS_TILE: 'terrain_grass_tile',
    STONE_PATH: 'terrain_stone_path',
    WATER_STREAM: 'terrain_water_stream',
  },
  PLOTS: {
    EMPTY: 'plot_empty',
    PLOWED: 'plot_plowed',
    WATERED: 'plot_watered',
    READY_GLOW: 'plot_ready_glow',
    LOCKED_WILD: 'plot_locked_wild',
  },
  PROPS: {
    AVORA_TREE: 'prop_avora_tree',
    TORII_GATE: 'prop_torii_gate',
    STONE_LANTERN: 'prop_stone_lantern',
    WOODEN_BRIDGE: 'prop_wooden_bridge',
    GARDEN_FENCE: 'prop_garden_fence',
    LUCKY_ENVELOPE: 'prop_lucky_envelope',
  },
  UI: {
    HARVEST_BADGE: 'ui_harvest_badge',
    AVORA_COIN: 'ui_avora_coin',
  },
  PARTICLES: {
    PETAL: 'particle_petal',
    WATER_DROP: 'particle_water_drop',
    SPARKLE: 'particle_sparkle',
    FIREFLY: 'particle_firefly',
    GOLD_STAR: 'particle_gold_star',
  },
  MUTATIONS: {
    GOLDEN_GRAPE: 'mutation_golden_grape',
    CRYSTAL_STRAWBERRY: 'mutation_crystal_strawberry',
    MOONLIGHT_SAKURA: 'mutation_moonlight_sakura',
    LUA_NGUYET_QUANG: 'mutation_lua_nguyet_quang',
    LUA_VANG_24K: 'mutation_lua_vang_24k',
    LUA_THACH_ANH_PHA_LE: 'mutation_lua_thach_anh_pha_le',
    TRA_LUC_BAO_UJI: 'mutation_tra_luc_bao_uji',
    NHO_HONG_NGOC: 'mutation_nho_hong_ngoc',
    NHO_NGOC_BICH: 'mutation_nho_ngoc_bich',
    CHANH_THAI_DUONG: 'mutation_chanh_thai_duong',
    CA_CHUA_HOANG_KIM: 'mutation_ca_chua_hoang_kim',
    BAP_HOANG_KIM: 'mutation_bap_hoang_kim',
  },
};

export interface AssetManifestEntry {
  key: string;
  path: string;
  fallbackPath?: string;
}

export const ESSENTIAL_ASSET_MANIFEST: AssetManifestEntry[] = [
  // Environment
  { key: FARM_ASSET_KEYS.ENVIRONMENT.SKY_DAYLIGHT, path: '/game/farm/environment/sky_daylight.avif', fallbackPath: '/game/farm/environment/sky_daylight.webp' },

  // Plots
  { key: FARM_ASSET_KEYS.PLOTS.EMPTY, path: '/game/farm/environment/plots/plot_empty.avif', fallbackPath: '/game/farm/environment/plots/plot_empty.webp' },
  { key: FARM_ASSET_KEYS.PLOTS.PLOWED, path: '/game/farm/environment/plots/plot_plowed.avif', fallbackPath: '/game/farm/environment/plots/plot_plowed.webp' },
  { key: FARM_ASSET_KEYS.PLOTS.WATERED, path: '/game/farm/environment/plots/plot_watered.avif', fallbackPath: '/game/farm/environment/plots/plot_watered.webp' },
  { key: FARM_ASSET_KEYS.PLOTS.READY_GLOW, path: '/game/farm/environment/plots/plot_ready_glow.avif', fallbackPath: '/game/farm/environment/plots/plot_ready_glow.webp' },
  { key: FARM_ASSET_KEYS.PLOTS.LOCKED_WILD, path: '/game/farm/environment/plots/plot_locked_wild.avif', fallbackPath: '/game/farm/environment/plots/plot_locked_wild.webp' },

  // Terrain
  { key: FARM_ASSET_KEYS.TERRAIN.ISLAND_CLIFF, path: '/game/farm/environment/terrain/island_cliff.avif', fallbackPath: '/game/farm/environment/terrain/island_cliff.webp' },
  { key: FARM_ASSET_KEYS.TERRAIN.GRASS_TILE, path: '/game/farm/environment/terrain/grass_tile.avif', fallbackPath: '/game/farm/environment/terrain/grass_tile.webp' },
  { key: FARM_ASSET_KEYS.TERRAIN.STONE_PATH, path: '/game/farm/environment/terrain/stone_path.avif', fallbackPath: '/game/farm/environment/terrain/stone_path.webp' },
  { key: FARM_ASSET_KEYS.TERRAIN.WATER_STREAM, path: '/game/farm/environment/terrain/water_stream.avif', fallbackPath: '/game/farm/environment/terrain/water_stream.webp' },

  { key: FARM_ASSET_KEYS.PROPS.AVORA_TREE, path: '/game/farm/environment/props/avora_tree.avif', fallbackPath: '/game/farm/environment/props/avora_tree.png' },
  { key: FARM_ASSET_KEYS.PROPS.TORII_GATE, path: '/game/farm/environment/props/torii_gate.avif', fallbackPath: '/game/farm/environment/props/torii_gate.webp' },
  { key: FARM_ASSET_KEYS.PROPS.STONE_LANTERN, path: '/game/farm/environment/props/stone_lantern.avif', fallbackPath: '/game/farm/environment/props/stone_lantern.webp' },
  { key: FARM_ASSET_KEYS.PROPS.WOODEN_BRIDGE, path: '/game/farm/environment/props/wooden_bridge.avif', fallbackPath: '/game/farm/environment/props/wooden_bridge.webp' },
  { key: FARM_ASSET_KEYS.PROPS.GARDEN_FENCE, path: '/game/farm/environment/props/garden_fence.avif', fallbackPath: '/game/farm/environment/props/garden_fence.webp' },
  { key: FARM_ASSET_KEYS.PROPS.LUCKY_ENVELOPE, path: '/game/farm/environment/props/lucky_envelope.webp', fallbackPath: '/game/farm/environment/props/lucky_envelope.png' },

  // UI Badges
  { key: FARM_ASSET_KEYS.UI.HARVEST_BADGE, path: '/game/farm/environment/props/harvest_badge.avif', fallbackPath: '/game/farm/environment/props/harvest_badge.webp' },
  { key: FARM_ASSET_KEYS.UI.AVORA_COIN, path: '/game/farm/environment/props/avora-coin.svg', fallbackPath: '/game/farm/environment/props/avora-coin.svg' },

  // Particles
  { key: FARM_ASSET_KEYS.PARTICLES.PETAL, path: '/game/farm/particles/petal.avif', fallbackPath: '/game/farm/particles/petal.webp' },
  { key: FARM_ASSET_KEYS.PARTICLES.WATER_DROP, path: '/game/farm/particles/water_drop.avif', fallbackPath: '/game/farm/particles/water_drop.webp' },
  { key: FARM_ASSET_KEYS.PARTICLES.SPARKLE, path: '/game/farm/particles/sparkle.avif', fallbackPath: '/game/farm/particles/sparkle.webp' },
  { key: FARM_ASSET_KEYS.PARTICLES.FIREFLY, path: '/game/farm/particles/firefly.avif', fallbackPath: '/game/farm/particles/firefly.webp' },
  { key: FARM_ASSET_KEYS.PARTICLES.GOLD_STAR, path: '/game/farm/particles/gold_star.avif', fallbackPath: '/game/farm/particles/gold_star.webp' },

  // Mutations (Bổ sung đầy đủ cho tất cả nông sản)
  { key: FARM_ASSET_KEYS.MUTATIONS.GOLDEN_GRAPE, path: '/game/farm/mutations/grape/nho_vang_hoang_gia.webp', fallbackPath: '/game/farm/mutations/golden-grape/plant.webp' },
  { key: FARM_ASSET_KEYS.MUTATIONS.CRYSTAL_STRAWBERRY, path: '/game/farm/mutations/strawberry/dau_tay_pha_le.webp', fallbackPath: '/game/farm/mutations/crystal-strawberry/plant.webp' },
  { key: FARM_ASSET_KEYS.MUTATIONS.MOONLIGHT_SAKURA, path: '/game/farm/mutations/moonlight-sakura/plant.webp', fallbackPath: '/game/farm/mutations/sakura/plant.webp' },
  { key: FARM_ASSET_KEYS.MUTATIONS.LUA_NGUYET_QUANG, path: '/game/farm/mutations/rice/lua_nguyet_quang.webp', fallbackPath: '/game/farm/mutations/rice/lua_nguyet_quang.png' },
  { key: FARM_ASSET_KEYS.MUTATIONS.LUA_VANG_24K, path: '/game/farm/mutations/rice/lua_vang_24k.webp', fallbackPath: '/game/farm/mutations/rice/lua_vang_24k.png' },
  { key: FARM_ASSET_KEYS.MUTATIONS.LUA_THACH_ANH_PHA_LE, path: '/game/farm/mutations/rice/lua_thach_anh_pha_le.webp', fallbackPath: '/game/farm/mutations/rice/lua_thach_anh_pha_le.png' },
  { key: FARM_ASSET_KEYS.MUTATIONS.TRA_LUC_BAO_UJI, path: '/game/farm/mutations/matcha/tra_luc_bao_uji.webp', fallbackPath: '/game/farm/mutations/matcha/plant.webp' },
  { key: FARM_ASSET_KEYS.MUTATIONS.NHO_HONG_NGOC, path: '/game/farm/mutations/grape/nho_hong_ngoc_de_vuong.webp', fallbackPath: '/game/farm/mutations/grape/plant.webp' },
  { key: FARM_ASSET_KEYS.MUTATIONS.NHO_NGOC_BICH, path: '/game/farm/mutations/grape/nho_ngoc_bich_shizuoka.webp', fallbackPath: '/game/farm/mutations/grape/plant.webp' },
  { key: FARM_ASSET_KEYS.MUTATIONS.CHANH_THAI_DUONG, path: '/game/farm/mutations/yuzu/chanh_thai_duong.webp', fallbackPath: '/game/farm/mutations/yuzu/plant.webp' },
  { key: FARM_ASSET_KEYS.MUTATIONS.CA_CHUA_HOANG_KIM, path: '/game/farm/mutations/tomato/ca_chua_hoang_kim.webp', fallbackPath: '/game/farm/mutations/tomato/plant.webp' },
  { key: FARM_ASSET_KEYS.MUTATIONS.BAP_HOANG_KIM, path: '/game/farm/mutations/corn/bap_hoang_kim.webp', fallbackPath: '/game/farm/mutations/corn/plant.webp' },
];

// Add Crop Stages for all 15 supported crops
const CROP_FOLDERS: Record<string, string> = {
  JAPANESE_RICE: 'rice',
  STRAWBERRY: 'strawberry',
  GRAPE: 'grape',
  MATCHA: 'matcha',
  MATCHA_LEAF: 'matcha',
  SAKURA: 'sakura',
  SAKURA_PEARL: 'sakura',
  YUZU: 'yuzu',
  CORN: 'corn',
  TOMATO: 'tomato',
  TUNA_CORAL: 'ocean-coral',
  SALMON_BLOSSOM: 'salmon-anise',
  SUNFLOWER: 'sunflower',
  WASABI: 'wasabi',
  SHISO: 'perilla',
  PEACH: 'peach',
  WASABI_CRYSTAL: 'wasabi',
};

export const CROP_ASSET_MANIFEST: AssetManifestEntry[] = [];

Object.entries(CROP_FOLDERS).forEach(([cropCode, folder]) => {
  for (let stage = 0; stage <= 5; stage++) {
    const key = `crop_${cropCode.toLowerCase()}_stage_${stage}`;
    CROP_ASSET_MANIFEST.push({
      key,
      path: `/game/farm/crops/${folder}/stage_${stage}.webp`,
      fallbackPath: `/game/farm/crops/${folder}/stage_${stage}.png`,
    });
  }
});

/**
 * Lấy Key texture cho cây trồng theo Code và Stage sinh trưởng
 */
export function getCropTextureKey(cropCode: string, stage: number): string {
  const normalized = (cropCode || '').toUpperCase().trim();
  const clampedStage = Math.max(0, Math.min(5, Math.floor(stage)));

  // Mapping alias theo đúng kho asset 15 giống cây
  let targetCode = 'JAPANESE_RICE';
  if (normalized.includes('STRAW')) targetCode = 'STRAWBERRY';
  else if (normalized.includes('GRAPE')) targetCode = 'GRAPE';
  else if (normalized.includes('MATCHA')) targetCode = 'MATCHA_LEAF';
  else if (normalized.includes('SAKURA')) targetCode = 'SAKURA_PEARL';
  else if (normalized.includes('YUZU')) targetCode = 'YUZU';
  else if (normalized.includes('CORN') || normalized.includes('BAP') || normalized.includes('NGO')) targetCode = 'CORN';
  else if (normalized.includes('TOMATO') || normalized.includes('CA_CHUA')) targetCode = 'TOMATO';
  else if (normalized.includes('CORAL') || normalized.includes('SAN_HO')) targetCode = 'TUNA_CORAL';
  else if (normalized.includes('SALMON') || normalized.includes('HOA_HOI')) targetCode = 'SALMON_BLOSSOM';
  else if (normalized.includes('SUNFLOWER') || normalized.includes('HUONG_DUONG')) targetCode = 'SUNFLOWER';
  else if (normalized.includes('WASABI_CRYSTAL') || normalized.includes('PHA_LE_WASABI')) targetCode = 'WASABI_CRYSTAL';
  else if (normalized.includes('WASABI')) targetCode = 'WASABI';
  else if (normalized.includes('SHISO') || normalized.includes('PERILLA') || normalized.includes('TIA_TO')) targetCode = 'SHISO';
  else if (normalized.includes('PEACH') || normalized.includes('DAO')) targetCode = 'PEACH';
  else if (normalized.includes('RICE')) targetCode = 'JAPANESE_RICE';
  else targetCode = normalized;

  return `crop_${targetCode.toLowerCase()}_stage_${clampedStage}`;
}

/**
 * Lấy Key texture cho thể đột biến
 */
export function getMutationTextureKey(mutationCode: string): string {
  const normalized = (mutationCode || '').toUpperCase().trim();

  // 1. Lúa
  if (normalized.includes('MOONLIGHT_RICE') || normalized.includes('NGUYET_QUANG')) {
    return FARM_ASSET_KEYS.MUTATIONS.LUA_NGUYET_QUANG;
  }
  if (normalized.includes('GOLDEN_RICE') || normalized.includes('VANG_24K')) {
    return FARM_ASSET_KEYS.MUTATIONS.LUA_VANG_24K;
  }
  if (normalized.includes('CRYSTAL_RICE') || normalized.includes('THACH_ANH')) {
    return FARM_ASSET_KEYS.MUTATIONS.LUA_THACH_ANH_PHA_LE;
  }
  if (normalized.includes('RICE')) {
    return FARM_ASSET_KEYS.MUTATIONS.LUA_VANG_24K;
  }

  // 2. Nho
  if (normalized.includes('RUBY') || normalized.includes('HONG_NGOC')) {
    return FARM_ASSET_KEYS.MUTATIONS.NHO_HONG_NGOC;
  }
  if (normalized.includes('JADE') || normalized.includes('NGOC_BICH')) {
    return FARM_ASSET_KEYS.MUTATIONS.NHO_NGOC_BICH;
  }
  if (normalized.includes('GOLD') || normalized.includes('GRAPE')) {
    return FARM_ASSET_KEYS.MUTATIONS.GOLDEN_GRAPE;
  }

  // 3. Dâu Tây
  if (normalized.includes('CRYSTAL') || normalized.includes('STRAWBERRY') || normalized.includes('PHA_LE') || normalized.includes('DAU_TAY')) {
    return FARM_ASSET_KEYS.MUTATIONS.CRYSTAL_STRAWBERRY;
  }

  // 4. Trà Matcha
  if (normalized.includes('MATCHA') || normalized.includes('LUC_BAO') || normalized.includes('EMERALD')) {
    return FARM_ASSET_KEYS.MUTATIONS.TRA_LUC_BAO_UJI;
  }

  // 5. Sakura / Ngọc trai
  if (normalized.includes('MOON') || normalized.includes('SAKURA') || normalized.includes('PEARL') || normalized.includes('NGUYET_HOA')) {
    return FARM_ASSET_KEYS.MUTATIONS.MOONLIGHT_SAKURA;
  }

  // 6. Yuzu
  if (normalized.includes('YUZU') || normalized.includes('CHANH') || normalized.includes('SOLAR')) {
    return FARM_ASSET_KEYS.MUTATIONS.CHANH_THAI_DUONG;
  }

  // 7. Cà chua
  if (normalized.includes('TOMATO') || normalized.includes('CA_CHUA')) {
    return FARM_ASSET_KEYS.MUTATIONS.CA_CHUA_HOANG_KIM;
  }

  // 8. Bắp ngô
  if (normalized.includes('CORN') || normalized.includes('BAP') || normalized.includes('NGO')) {
    return FARM_ASSET_KEYS.MUTATIONS.BAP_HOANG_KIM;
  }

  // Fallback an toàn mặc định
  return FARM_ASSET_KEYS.MUTATIONS.CRYSTAL_STRAWBERRY;
}
