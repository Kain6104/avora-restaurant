import { ISOMETRIC_CONFIG } from '../config/FarmMapConfig';

export class IsometricGrid {
  private tileWidth: number;
  private tileHeight: number;
  private halfWidth: number;
  private halfHeight: number;

  constructor(tileWidth = ISOMETRIC_CONFIG.TILE_WIDTH, tileHeight = ISOMETRIC_CONFIG.TILE_HEIGHT) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.halfWidth = tileWidth / 2;
    this.halfHeight = tileHeight / 2;
  }

  /**
   * Chuyển đổi từ tọa độ lưới (gridRow, gridCol) sang tọa độ thế giới (worldX, worldY)
   */
  gridToWorld(row: number, col: number, originOffsetX = 0, originOffsetY = 0): { x: number; y: number } {
    const x = (col - row) * this.halfWidth + originOffsetX;
    const y = (col + row) * this.halfHeight + originOffsetY;
    return { x, y };
  }

  /**
   * Chuyển đổi ngược từ tọa độ con trỏ / touch sang ô đất (gridRow, gridCol)
   */
  worldToGrid(worldX: number, worldY: number, originOffsetX = 0, originOffsetY = 0): { row: number; col: number } {
    const adjX = worldX - originOffsetX;
    const adjY = worldY - originOffsetY;

    const col = (adjX / this.halfWidth + adjY / this.halfHeight) / 2;
    const row = (adjY / this.halfHeight - adjX / this.halfWidth) / 2;

    return { row: Math.round(row), col: Math.round(col) };
  }

  /**
   * Tính toán độ sâu (Z-index/Depth) chuẩn xác dựa trên chân của thực thể
   */
  calculateDepth(worldY: number, depthOffset = 0): number {
    return Math.floor(worldY * 10 + depthOffset);
  }
}
