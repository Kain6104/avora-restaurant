/**
 * AVORA FARM - ISOMETRIC MAP SPECIFICATION & LAYER CONFIG
 * Đồng bộ toàn diện với FarmWorldLayoutConfig
 */

import { FarmWorldLayoutConfig, PropAnchorConfig } from './FarmWorldLayoutConfig';

export const ISOMETRIC_CONFIG = {
  TILE_WIDTH: FarmWorldLayoutConfig.TILE_WIDTH,
  TILE_HEIGHT: FarmWorldLayoutConfig.TILE_HEIGHT,
  GRID_SIZE: FarmWorldLayoutConfig.GRID_SIZE,
  WORLD_OFFSET_X: FarmWorldLayoutConfig.GRID_ORIGIN_X,
  WORLD_OFFSET_Y: FarmWorldLayoutConfig.GRID_ORIGIN_Y,
  LIGHT_DIRECTION: { x: -0.7, y: -0.7 },
  CAMERA: FarmWorldLayoutConfig.CAMERA,
};

export type MapPropConfig = PropAnchorConfig;

export const ENVIRONMENT_PROPS_CONFIG: MapPropConfig[] = FarmWorldLayoutConfig.PROPS_ANCHORS;
