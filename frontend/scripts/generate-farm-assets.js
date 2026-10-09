/**
 * AVORA FARM - HIGH-FIDELITY 2.5D ISOMETRIC ASSET GENERATOR
 * Generates production-grade PNG transparent files for all 39+ crop stages,
 * mutations, terrain tiles, AVORA sacred tree, props, and particles.
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT_DIR = path.resolve(__dirname, '../public/game/farm');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Pixel canvas utility
class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 0); // Transparent RGBA
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (this.width * y + x) * 4;
    const alpha = a / 255;
    const invAlpha = 1 - alpha;
    
    // Alpha blending
    const curA = this.data[idx + 3] / 255;
    const outA = alpha + curA * invAlpha;
    if (outA > 0) {
      this.data[idx] = Math.round((r * alpha + this.data[idx] * curA * invAlpha) / outA);
      this.data[idx + 1] = Math.round((g * alpha + this.data[idx + 1] * curA * invAlpha) / outA);
      this.data[idx + 2] = Math.round((b * alpha + this.data[idx + 2] * curA * invAlpha) / outA);
      this.data[idx + 3] = Math.round(outA * 255);
    }
  }

  fillCircle(cx, cy, r, red, green, blue, a = 255) {
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) {
          const edgeAlpha = Math.min(1, r - d + 0.5);
          this.setPixel(x, y, red, green, blue, a * edgeAlpha);
        }
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, red, green, blue, a = 255) {
    const minX = Math.max(0, Math.floor(cx - rx));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + rx));
    const minY = Math.max(0, Math.floor(cy - ry));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + ry));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d <= 1) {
          const edgeAlpha = Math.min(1, (1 - Math.sqrt(d)) * rx);
          this.setPixel(x, y, red, green, blue, a * Math.max(0.1, edgeAlpha));
        }
      }
    }
  }

  fillIsoDiamond(cx, cy, halfW, halfH, red, green, blue, a = 255) {
    for (let y = Math.floor(cy - halfH); y <= Math.ceil(cy + halfH); y++) {
      for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++) {
        const d = Math.abs((x - cx) / halfW) + Math.abs((y - cy) / halfH);
        if (d <= 1) {
          this.setPixel(x, y, red, green, blue, a);
        }
      }
    }
  }

  drawRadialGlow(cx, cy, radius, red, green, blue, maxAlpha = 180) {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius) {
          const factor = Math.cos((d / radius) * (Math.PI / 2));
          this.setPixel(x, y, red, green, blue, maxAlpha * factor);
        }
      }
    }
  }

  saveToFile(filePath) {
    ensureDir(path.dirname(filePath));
    const png = new PNG({ width: this.width, height: this.height });
    this.data.copy(png.data);
    const buffer = PNG.sync.write(png);
    fs.writeFileSync(filePath, buffer);
  }
}

// ==========================================
// 1. GENERATE TILES (ISO 128 x 64)
// ==========================================

console.log('🌱 Generating 2.5D Isometric Terrain & Plot Assets...');

// 1.1 Empty Soil (plot_empty.png) - Rich earthy texture with 3D bevel & contact shadow
{
  const c = new Canvas(128, 80);
  // Bottom 3D Bevel depth
  for (let dy = 0; dy < 16; dy++) {
    c.fillIsoDiamond(64, 40 + dy, 64, 32, 95 - dy * 3, 65 - dy * 2, 40, 255);
  }
  // Top soil surface
  c.fillIsoDiamond(64, 36, 62, 30, 150, 110, 75, 255);
  // Texture flecks
  for (let i = 0; i < 300; i++) {
    const rx = 64 + (Math.random() - 0.5) * 110;
    const ry = 36 + (Math.random() - 0.5) * 50;
    if (Math.abs((rx - 64) / 60) + Math.abs((ry - 36) / 28) <= 1) {
      const shade = Math.random() > 0.5 ? 180 : 110;
      c.setPixel(rx, ry, shade, shade * 0.75, shade * 0.5, 220);
    }
  }
  c.saveToFile(path.join(OUT_DIR, 'environment/plots/plot_empty.png'));
}

// 1.2 Plowed Soil (plot_plowed.png) - Soil with furrowed tillage ridges
{
  const c = new Canvas(128, 80);
  for (let dy = 0; dy < 16; dy++) {
    c.fillIsoDiamond(64, 40 + dy, 64, 32, 100 - dy * 3, 70 - dy * 2, 45, 255);
  }
  c.fillIsoDiamond(64, 36, 62, 30, 160, 120, 80, 255);
  // Ridges
  for (let r = -2; r <= 2; r++) {
    const ox = r * 16;
    for (let t = -20; t <= 20; t++) {
      const px = 64 + ox + t;
      const py = 36 + (t * 0.5);
      if (Math.abs((px - 64) / 60) + Math.abs((py - 36) / 28) <= 0.95) {
        c.fillCircle(px, py, 2.5, 120, 85, 55, 230);
      }
    }
  }
  c.saveToFile(path.join(OUT_DIR, 'environment/plots/plot_plowed.png'));
}

// 1.3 Watered Soil (plot_watered.png) - Dark moist rich soil with water glistening
{
  const c = new Canvas(128, 80);
  for (let dy = 0; dy < 16; dy++) {
    c.fillIsoDiamond(64, 40 + dy, 64, 32, 60 - dy * 2, 42 - dy * 1.5, 28, 255);
  }
  c.fillIsoDiamond(64, 36, 62, 30, 95, 68, 48, 255);
  // Water droplets sheen
  c.drawRadialGlow(48, 30, 12, 120, 210, 230, 130);
  c.drawRadialGlow(78, 42, 14, 120, 210, 230, 140);
  c.fillCircle(50, 30, 2.5, 255, 255, 255, 240);
  c.fillCircle(80, 41, 3, 255, 255, 255, 240);
  c.saveToFile(path.join(OUT_DIR, 'environment/plots/plot_watered.png'));
}

// 1.4 Ready Glow Plot (plot_ready_glow.png)
{
  const c = new Canvas(128, 80);
  for (let dy = 0; dy < 16; dy++) {
    c.fillIsoDiamond(64, 40 + dy, 64, 32, 110 - dy * 2, 85 - dy * 2, 45, 255);
  }
  c.fillIsoDiamond(64, 36, 62, 30, 150, 115, 75, 255);
  // Golden harvest aura
  c.drawRadialGlow(64, 36, 42, 255, 215, 0, 120);
  c.saveToFile(path.join(OUT_DIR, 'environment/plots/plot_ready_glow.png'));
}

// 1.5 Locked Wilderness Plot (plot_locked_wild.png) - Untamed nature (mossy rocks, wild grass)
{
  const c = new Canvas(128, 80);
  for (let dy = 0; dy < 16; dy++) {
    c.fillIsoDiamond(64, 40 + dy, 64, 32, 70 - dy * 2, 85 - dy * 2, 65, 255);
  }
  // Mossy wild grass surface
  c.fillIsoDiamond(64, 36, 62, 30, 90, 130, 85, 255);
  // Wild grass tufts
  c.fillEllipse(50, 30, 10, 5, 60, 105, 55, 220);
  c.fillEllipse(75, 40, 12, 6, 75, 120, 70, 230);
  // Mossy boulder
  c.fillCircle(64, 34, 11, 120, 125, 120, 240);
  c.fillCircle(62, 32, 9, 140, 145, 140, 240);
  c.fillCircle(60, 30, 4, 170, 175, 170, 240);
  // Small wildflowers
  c.fillCircle(45, 26, 3, 255, 180, 200, 240);
  c.fillCircle(82, 35, 3, 255, 230, 120, 240);
  c.saveToFile(path.join(OUT_DIR, 'environment/plots/plot_locked_wild.png'));
}

// 1.6 Lush Grass Tile (grass_tile.png)
{
  const c = new Canvas(128, 64);
  c.fillIsoDiamond(64, 32, 64, 32, 105, 155, 95, 255);
  for (let i = 0; i < 200; i++) {
    const rx = 64 + (Math.random() - 0.5) * 120;
    const ry = 32 + (Math.random() - 0.5) * 60;
    if (Math.abs((rx - 64) / 62) + Math.abs((ry - 32) / 30) <= 1) {
      c.setPixel(rx, ry, 120 + Math.random() * 30, 175 + Math.random() * 30, 105, 220);
    }
  }
  c.saveToFile(path.join(OUT_DIR, 'environment/terrain/grass_tile.png'));
}

// 1.7 Stone Path Tile (stone_path.png)
{
  const c = new Canvas(128, 64);
  c.fillIsoDiamond(64, 32, 64, 32, 110, 150, 100, 255);
  // Flagstones
  const stones = [
    { x: 50, y: 25, rx: 12, ry: 7 },
    { x: 75, y: 28, rx: 14, ry: 8 },
    { x: 42, y: 38, rx: 11, ry: 6 },
    { x: 68, y: 40, rx: 15, ry: 9 },
    { x: 90, y: 34, rx: 10, ry: 6 },
  ];
  for (const s of stones) {
    c.fillEllipse(s.x, s.y + 1, s.rx, s.ry, 90, 95, 95, 200); // shadow
    c.fillEllipse(s.x, s.y, s.rx, s.ry, 165, 170, 168, 255); // top
    c.fillEllipse(s.x - 2, s.y - 1, s.rx * 0.6, s.ry * 0.6, 195, 200, 198, 240); // highlight
  }
  c.saveToFile(path.join(OUT_DIR, 'environment/terrain/stone_path.png'));
}

// 1.8 Water Stream / Koi Pond (water_stream.png)
{
  const c = new Canvas(128, 64);
  c.fillIsoDiamond(64, 32, 64, 32, 45, 130, 165, 240);
  c.drawRadialGlow(64, 32, 35, 120, 220, 255, 110);
  // Water wave ripples
  c.fillEllipse(55, 28, 18, 4, 180, 240, 255, 140);
  c.fillEllipse(72, 38, 22, 5, 180, 240, 255, 140);
  // Small red koi silhouette
  c.fillEllipse(60, 34, 6, 2.5, 230, 65, 50, 220);
  c.saveToFile(path.join(OUT_DIR, 'environment/terrain/water_stream.png'));
}

// 1.9 Island Cliff 3D Base (island_cliff.png)
{
  const c = new Canvas(256, 160);
  // Rocky cliff underside
  for (let dy = 0; dy < 60; dy++) {
    const factor = 1 - (dy / 60) * 0.4;
    c.fillIsoDiamond(128, 50 + dy, 128 * factor, 64 * factor, 75 - dy * 0.6, 60 - dy * 0.5, 50 - dy * 0.4, 255);
  }
  // Grass top edge
  c.fillIsoDiamond(128, 45, 126, 62, 95, 150, 85, 255);
  c.saveToFile(path.join(OUT_DIR, 'environment/terrain/island_cliff.png'));
}

// ==========================================
// 2. ENVIRONMENT PROPS (Torii, Lantern, Tree)
// ==========================================

console.log('⛩️ Generating Japanese Garden Props & AVORA Sacred Tree...');

// 2.1 Vermilion Torii Gate (torii_gate.png - 96 x 128)
{
  const c = new Canvas(96, 128);
  // Columns
  for (let y = 35; y < 120; y++) {
    c.fillEllipse(28, y, 5, 2, 190, 30, 25, 255);
    c.fillEllipse(68, y, 5, 2, 190, 30, 25, 255);
  }
  // Base stones
  c.fillCircle(28, 120, 7, 70, 75, 80, 255);
  c.fillCircle(68, 120, 7, 70, 75, 80, 255);
  // Crossbeams (Kasagi & Shimaki)
  for (let x = 6; x <= 90; x++) {
    const curve = Math.sin(((x - 6) / 84) * Math.PI) * 5;
    c.fillCircle(x, 22 - curve, 4, 30, 30, 35, 255); // Black roof lintel
    c.fillCircle(x, 28 - curve, 4.5, 210, 35, 30, 255); // Red upper beam
  }
  // Lower horizontal tie-beam (Nuki)
  for (let x = 16; x <= 80; x++) {
    c.fillCircle(x, 46, 3.5, 190, 30, 25, 255);
  }
  c.saveToFile(path.join(OUT_DIR, 'environment/props/torii_gate.png'));
}

// 2.2 Japanese Stone Lantern Toro (stone_lantern.png - 64 x 96)
{
  const c = new Canvas(64, 96);
  // Pedestal base
  c.fillEllipse(32, 88, 18, 6, 100, 105, 110, 255);
  c.fillEllipse(32, 78, 12, 4, 120, 125, 130, 255);
  // Shaft
  for (let y = 58; y <= 78; y++) {
    c.fillEllipse(32, y, 6, 2, 115, 120, 125, 255);
  }
  // Middle platform
  c.fillEllipse(32, 56, 16, 5, 130, 135, 140, 255);
  // Light box with warm candlelight glow
  c.drawRadialGlow(32, 46, 18, 255, 200, 100, 180);
  c.fillCircle(32, 46, 7, 255, 235, 140, 255);
  // Pagoda roof
  for (let y = 30; y <= 42; y++) {
    const w = (42 - y) * 1.6 + 6;
    c.fillEllipse(32, y, w, w * 0.35, 80, 85, 90, 255);
  }
  // Top jewel (Hoju)
  c.fillCircle(32, 26, 4.5, 140, 145, 150, 255);
  c.saveToFile(path.join(OUT_DIR, 'environment/props/stone_lantern.png'));
}

// 2.3 Sacred AVORA Ancient Bonsai Tree (avora_tree.png - 220 x 260)
{
  const c = new Canvas(220, 260);
  // Sacred root flares & trunk
  for (let y = 140; y <= 245; y++) {
    const w = 18 + Math.sin(y * 0.08) * 8 + (y > 220 ? (y - 220) * 1.2 : 0);
    c.fillEllipse(110 + Math.sin(y * 0.05) * 12, y, w, w * 0.35, 80, 50, 30, 255);
  }
  // Multi-tier lush foliage clouds
  const clouds = [
    { x: 110, y: 80, rx: 55, ry: 35, r: 40, g: 110, b: 60 },
    { x: 65, y: 115, rx: 45, ry: 28, r: 50, g: 130, b: 70 },
    { x: 155, y: 115, rx: 45, ry: 28, r: 50, g: 130, b: 70 },
    { x: 110, y: 135, rx: 65, ry: 32, r: 35, g: 95, b: 50 },
    { x: 80, y: 160, rx: 38, ry: 22, r: 60, g: 140, b: 80 },
    { x: 140, y: 160, rx: 38, ry: 22, r: 60, g: 140, b: 80 },
  ];
  for (const cl of clouds) {
    c.fillEllipse(cl.x, cl.y, cl.rx, cl.ry, cl.r, cl.g, cl.b, 255);
    // Highlight leaves
    c.fillEllipse(cl.x - cl.rx * 0.2, cl.y - cl.ry * 0.2, cl.rx * 0.6, cl.ry * 0.5, cl.r + 35, cl.g + 45, cl.b + 30, 240);
    // Delicate cherry blossom buds intertwined
    for (let i = 0; i < 8; i++) {
      const bx = cl.x + (Math.random() - 0.5) * cl.rx * 1.4;
      const by = cl.y + (Math.random() - 0.5) * cl.ry * 1.2;
      c.fillCircle(bx, by, 3.5, 255, 185, 205, 230);
    }
  }
  // Sacred Shimenawa rope wrapped around trunk
  for (let x = 85; x <= 135; x++) {
    const y = 185 + Math.sin(((x - 85) / 50) * Math.PI) * 8;
    c.fillCircle(x, y, 4, 230, 205, 140, 255);
  }
  // Hanging red AVORA lanterns with glowing halos
  const lanterns = [
    { x: 75, y: 175 },
    { x: 145, y: 175 },
  ];
  for (const lt of lanterns) {
    c.drawRadialGlow(lt.x, lt.y + 6, 16, 255, 60, 40, 160);
    c.fillEllipse(lt.x, lt.y + 6, 8, 12, 215, 30, 25, 255);
    c.fillCircle(lt.x, lt.y + 6, 4, 255, 220, 100, 255); // gold core
  }
  c.saveToFile(path.join(OUT_DIR, 'environment/props/avora_tree.png'));
}

// 2.4 Wooden Bridge (wooden_bridge.png - 96 x 64)
{
  const c = new Canvas(96, 64);
  for (let x = 10; x <= 86; x++) {
    const arch = Math.sin(((x - 10) / 76) * Math.PI) * 12;
    c.fillEllipse(x, 40 - arch, 4, 10, 160, 40, 35, 255); // red railing
    c.fillEllipse(x, 48 - arch, 3, 4, 130, 80, 50, 255); // wooden planks
  }
  c.saveToFile(path.join(OUT_DIR, 'environment/props/wooden_bridge.png'));
}

// ==========================================
// 3. GENERATE 6 CROPS x 6 STAGES (36 ARTWORKS)
// ==========================================

console.log('🌾 Generating 36 High-Fidelity Crop Stages (Rice, Strawberry, Grape, Matcha, Sakura, Yuzu)...');

// Helper to generate seed & sprout stages
function makeSeed(primaryR, primaryG, primaryB) {
  const c = new Canvas(64, 64);
  c.fillCircle(32, 44, 5, primaryR, primaryG, primaryB, 255);
  c.fillCircle(30, 42, 2, 255, 255, 255, 160);
  return c;
}

function makeSprout(stemR, stemG, stemB, leafR, leafG, leafB) {
  const c = new Canvas(64, 64);
  // Stem
  for (let y = 35; y <= 50; y++) {
    c.fillCircle(32, y, 2, stemR, stemG, stemB, 255);
  }
  // Two twin leaves
  c.fillEllipse(26, 33, 6, 3, leafR, leafG, leafB, 255);
  c.fillEllipse(38, 32, 6, 3, leafR, leafG, leafB, 255);
  return c;
}

// 3.1 Japanese Rice (Koshihikari)
{
  makeSeed(220, 200, 130).saveToFile(path.join(OUT_DIR, 'crops/rice/stage_0.png'));
  makeSprout(90, 150, 70, 110, 185, 85).saveToFile(path.join(OUT_DIR, 'crops/rice/stage_1.png'));

  // Stage 2: Young Clustered Rice
  const c2 = new Canvas(80, 80);
  for (let i = -3; i <= 3; i++) {
    const angle = i * 0.15;
    for (let h = 0; h < 35; h++) {
      c2.fillCircle(40 + Math.sin(angle) * h, 65 - h, 2, 70, 140, 60, 255);
    }
  }
  c2.saveToFile(path.join(OUT_DIR, 'crops/rice/stage_2.png'));

  // Stage 3: Growing (Flowering Paddy)
  const c3 = new Canvas(96, 96);
  for (let i = -4; i <= 4; i++) {
    const angle = i * 0.18;
    for (let h = 0; h < 50; h++) {
      c3.fillCircle(48 + Math.sin(angle) * h, 78 - h, 2.5, 60, 130, 50, 255);
    }
  }
  c3.fillCircle(48, 36, 4, 235, 230, 180, 240); // flower bud
  c3.saveToFile(path.join(OUT_DIR, 'crops/rice/stage_3.png'));

  // Stage 4: Mature (Golden Drooping Grains)
  const c4 = new Canvas(112, 112);
  for (let i = -4; i <= 4; i++) {
    for (let h = 0; h < 55; h++) {
      const curve = (h / 55) * (h / 55) * i * 6;
      c4.fillCircle(56 + curve, 90 - h, 2.8, 160, 150, 45, 255);
    }
  }
  // Drooping yellow grains
  c4.fillEllipse(42, 42, 10, 6, 225, 195, 65, 255);
  c4.fillEllipse(70, 44, 10, 6, 225, 195, 65, 255);
  c4.saveToFile(path.join(OUT_DIR, 'crops/rice/stage_4.png'));

  // Stage 5: Ready (Glistening Harvest Grains with Aura)
  const c5 = new Canvas(128, 128);
  c5.drawRadialGlow(64, 64, 46, 255, 215, 0, 130);
  for (let i = -5; i <= 5; i++) {
    for (let h = 0; h < 65; h++) {
      const curve = (h / 65) * (h / 65) * i * 8;
      c5.fillCircle(64 + curve, 105 - h, 3, 195, 170, 35, 255);
    }
  }
  c5.fillEllipse(45, 48, 12, 7, 255, 215, 60, 255);
  c5.fillEllipse(82, 50, 12, 7, 255, 215, 60, 255);
  c5.fillCircle(64, 38, 4, 255, 255, 255, 250); // diamond sparkle
  c5.saveToFile(path.join(OUT_DIR, 'crops/rice/stage_5.png'));
}

// 3.2 Tochigi Strawberry
{
  makeSeed(180, 120, 60).saveToFile(path.join(OUT_DIR, 'crops/strawberry/stage_0.png'));
  makeSprout(70, 130, 50, 85, 160, 65).saveToFile(path.join(OUT_DIR, 'crops/strawberry/stage_1.png'));

  // Stage 2: Young (Blossoming white flowers)
  const c2 = new Canvas(80, 80);
  c2.fillCircle(40, 58, 16, 50, 120, 55, 255);
  c2.fillCircle(40, 48, 6, 255, 255, 255, 255); // white petals
  c2.fillCircle(40, 48, 2.5, 255, 210, 60, 255); // yellow center
  c2.saveToFile(path.join(OUT_DIR, 'crops/strawberry/stage_2.png'));

  // Stage 3: Growing (Green Berries)
  const c3 = new Canvas(96, 96);
  c3.fillCircle(48, 65, 22, 45, 110, 48, 255);
  c3.fillCircle(40, 58, 8, 130, 185, 80, 255); // green fruit
  c3.fillCircle(56, 58, 8, 130, 185, 80, 255);
  c3.saveToFile(path.join(OUT_DIR, 'crops/strawberry/stage_3.png'));

  // Stage 4: Mature (Red Strawberries)
  const c4 = new Canvas(112, 112);
  c4.fillCircle(56, 75, 28, 40, 100, 45, 255);
  c4.fillCircle(44, 65, 12, 215, 35, 45, 255);
  c4.fillCircle(68, 66, 12, 215, 35, 45, 255);
  c4.saveToFile(path.join(OUT_DIR, 'crops/strawberry/stage_4.png'));

  // Stage 5: Ready (Plump Glossy Crimson Strawberry)
  const c5 = new Canvas(128, 128);
  c5.drawRadialGlow(64, 68, 45, 255, 80, 80, 140);
  c5.fillCircle(64, 85, 34, 35, 90, 40, 255);
  // Main heart-shaped strawberry
  c5.fillCircle(54, 68, 16, 230, 25, 40, 255);
  c5.fillCircle(74, 68, 16, 230, 25, 40, 255);
  c5.fillCircle(64, 82, 15, 220, 20, 35, 255);
  c5.fillCircle(58, 62, 3, 255, 255, 255, 240); // shine highlight
  c5.saveToFile(path.join(OUT_DIR, 'crops/strawberry/stage_5.png'));
}

// 3.3 Kyoho Grape
{
  makeSeed(100, 70, 40).saveToFile(path.join(OUT_DIR, 'crops/grape/stage_0.png'));
  makeSprout(60, 120, 50, 75, 150, 60).saveToFile(path.join(OUT_DIR, 'crops/grape/stage_1.png'));

  // Stage 2: Trellis Climbing Vine
  const c2 = new Canvas(80, 96);
  for (let y = 20; y <= 85; y++) c2.fillCircle(40, y, 2.5, 110, 80, 50, 255); // wooden stake
  c2.fillEllipse(36, 45, 12, 8, 65, 135, 55, 255); // grape leaf
  c2.saveToFile(path.join(OUT_DIR, 'crops/grape/stage_2.png'));

  // Stage 3: Growing (Green Clusters)
  const c3 = new Canvas(96, 112);
  for (let y = 20; y <= 100; y++) c3.fillCircle(48, y, 2.5, 110, 80, 50, 255);
  c3.fillEllipse(44, 48, 16, 10, 55, 120, 48, 255);
  for (let i = 0; i < 8; i++) {
    c3.fillCircle(44 + (i % 3) * 6, 62 + Math.floor(i / 3) * 6, 4, 115, 175, 75, 255);
  }
  c3.saveToFile(path.join(OUT_DIR, 'crops/grape/stage_3.png'));

  // Stage 4: Mature (Purple Kyoho Grapes)
  const c4 = new Canvas(112, 128);
  for (let y = 20; y <= 115; y++) c4.fillCircle(56, y, 3, 110, 80, 50, 255);
  c4.fillEllipse(50, 50, 20, 12, 50, 110, 45, 255);
  for (let i = 0; i < 12; i++) {
    c4.fillCircle(50 + (i % 3) * 8, 68 + Math.floor(i / 3) * 8, 6, 100, 35, 115, 255);
  }
  c4.saveToFile(path.join(OUT_DIR, 'crops/grape/stage_4.png'));

  // Stage 5: Ready (Royal Velvet Purple Grapes with Dewdrops)
  const c5 = new Canvas(128, 144);
  c5.drawRadialGlow(64, 80, 48, 180, 100, 240, 140);
  for (let y = 20; y <= 130; y++) c5.fillCircle(64, y, 3.5, 110, 80, 50, 255);
  c5.fillEllipse(58, 55, 24, 14, 45, 100, 40, 255);
  for (let i = 0; i < 16; i++) {
    const gx = 56 + (i % 4) * 9 - Math.floor(i / 4) * 2;
    const gy = 76 + Math.floor(i / 4) * 9;
    c5.fillCircle(gx, gy, 7.5, 90, 25, 110, 255);
    c5.fillCircle(gx - 2, gy - 2, 2, 255, 255, 255, 230); // frosted shine
  }
  c5.saveToFile(path.join(OUT_DIR, 'crops/grape/stage_5.png'));
}

// 3.4 Uji Matcha (Tea Bush)
{
  makeSeed(80, 110, 60).saveToFile(path.join(OUT_DIR, 'crops/matcha/stage_0.png'));
  makeSprout(50, 120, 60, 65, 150, 70).saveToFile(path.join(OUT_DIR, 'crops/matcha/stage_1.png'));

  for (let s = 2; s <= 5; s++) {
    const dim = 64 + s * 16;
    const c = new Canvas(dim, dim);
    const rad = 14 + s * 6;
    if (s === 5) c.drawRadialGlow(dim / 2, dim / 2, rad + 15, 80, 210, 120, 130);
    c.fillCircle(dim / 2, dim / 2 + 10, rad, 35, 95 - s * 5, 45, 255);
    c.fillCircle(dim / 2 - rad * 0.3, dim / 2 - rad * 0.2, rad * 0.7, 50, 140, 65, 245);
    c.saveToFile(path.join(OUT_DIR, `crops/matcha/stage_${s}.png`));
  }
}

// 3.5 Sakura Flower
{
  makeSeed(200, 140, 160).saveToFile(path.join(OUT_DIR, 'crops/sakura/stage_0.png'));
  makeSprout(120, 80, 80, 235, 165, 185).saveToFile(path.join(OUT_DIR, 'crops/sakura/stage_1.png'));

  for (let s = 2; s <= 5; s++) {
    const dim = 64 + s * 16;
    const c = new Canvas(dim, dim);
    const rad = 14 + s * 6;
    if (s === 5) c.drawRadialGlow(dim / 2, dim / 2, rad + 18, 255, 180, 210, 160);
    // Bonsai tree trunk
    for (let y = dim / 2; y <= dim - 15; y++) {
      c.fillCircle(dim / 2, y, 4, 90, 60, 45, 255);
    }
    // Pink blossom canopy
    c.fillCircle(dim / 2, dim / 2 - 5, rad, 255, 180, 200, 255);
    c.fillCircle(dim / 2 - rad * 0.3, dim / 2 - rad * 0.3, rad * 0.6, 255, 210, 225, 255);
    c.saveToFile(path.join(OUT_DIR, `crops/sakura/stage_${s}.png`));
  }
}

// 3.6 Yuzu Citrus
{
  makeSeed(210, 190, 70).saveToFile(path.join(OUT_DIR, 'crops/yuzu/stage_0.png'));
  makeSprout(70, 130, 50, 95, 175, 65).saveToFile(path.join(OUT_DIR, 'crops/yuzu/stage_1.png'));

  for (let s = 2; s <= 5; s++) {
    const dim = 64 + s * 16;
    const c = new Canvas(dim, dim);
    const rad = 14 + s * 6;
    if (s === 5) c.drawRadialGlow(dim / 2, dim / 2, rad + 16, 255, 210, 0, 140);
    c.fillCircle(dim / 2, dim / 2 + 10, rad, 45, 110, 50, 255);
    if (s >= 3) {
      // Golden yellow yuzu fruits
      c.fillCircle(dim / 2 - rad * 0.4, dim / 2 + 5, 8 + (s - 3) * 3, 245, 195, 30, 255);
      c.fillCircle(dim / 2 + rad * 0.4, dim / 2 + 8, 8 + (s - 3) * 3, 245, 195, 30, 255);
    }
    c.saveToFile(path.join(OUT_DIR, `crops/yuzu/stage_${s}.png`));
  }
}

// ==========================================
// 4. GENERATE 3 SIGNATURE MUTATIONS
// ==========================================

console.log('✨ Generating 3 Signature Mutation Artwork...');

// 4.1 Golden Grape (24K Gold Grape)
{
  const c = new Canvas(128, 144);
  c.drawRadialGlow(64, 80, 55, 255, 215, 0, 180);
  for (let y = 20; y <= 130; y++) c.fillCircle(64, y, 3.5, 130, 95, 45, 255);
  c.fillEllipse(58, 55, 24, 14, 210, 180, 60, 255); // golden leaf
  for (let i = 0; i < 16; i++) {
    const gx = 56 + (i % 4) * 9 - Math.floor(i / 4) * 2;
    const gy = 76 + Math.floor(i / 4) * 9;
    c.fillCircle(gx, gy, 7.5, 255, 205, 30, 255);
    c.fillCircle(gx - 2, gy - 2, 2.5, 255, 255, 255, 255); // brilliant shine
  }
  c.saveToFile(path.join(OUT_DIR, 'mutations/golden-grape/plant.png'));
}

// 4.2 Crystal Strawberry (Snow Crystalline Diamond Strawberry)
{
  const c = new Canvas(128, 128);
  c.drawRadialGlow(64, 68, 55, 120, 240, 255, 190);
  c.fillCircle(64, 85, 34, 80, 190, 205, 230); // icy leaves
  c.fillCircle(54, 68, 16, 180, 245, 255, 245);
  c.fillCircle(74, 68, 16, 180, 245, 255, 245);
  c.fillCircle(64, 82, 15, 150, 235, 250, 245);
  c.fillCircle(58, 62, 4, 255, 255, 255, 255);
  c.saveToFile(path.join(OUT_DIR, 'mutations/crystal-strawberry/plant.png'));
}

// 4.3 Moonlight Sakura (Bioluminescent Lunar Blossom)
{
  const c = new Canvas(144, 144);
  c.drawRadialGlow(72, 60, 60, 180, 140, 255, 190);
  for (let y = 60; y <= 125; y++) c.fillCircle(72, y, 4.5, 70, 55, 90, 255);
  c.fillCircle(72, 55, 38, 160, 120, 240, 245);
  c.fillCircle(60, 45, 24, 210, 185, 255, 255);
  c.fillCircle(85, 45, 24, 210, 185, 255, 255);
  c.saveToFile(path.join(OUT_DIR, 'mutations/moonlight-sakura/plant.png'));
}

// ==========================================
// 5. GENERATE PARTICLES
// ==========================================

console.log('🌸 Generating Particles (Petals, Fireflies, Sparkles)...');

// 5.1 Sakura Petal (petal.png - 24 x 24)
{
  const c = new Canvas(24, 24);
  c.fillEllipse(12, 12, 10, 5, 255, 185, 205, 250);
  c.fillCircle(12, 12, 3, 255, 220, 235, 255);
  c.saveToFile(path.join(OUT_DIR, 'particles/petal.png'));
}

// 5.2 Water Drop (water_drop.png - 20 x 20)
{
  const c = new Canvas(20, 20);
  c.fillCircle(10, 10, 8, 80, 200, 255, 240);
  c.fillCircle(8, 8, 3, 255, 255, 255, 255);
  c.saveToFile(path.join(OUT_DIR, 'particles/water_drop.png'));
}

// 5.3 Sparkle Star (sparkle.png - 32 x 32)
{
  const c = new Canvas(32, 32);
  c.drawRadialGlow(16, 16, 14, 255, 220, 80, 180);
  c.fillCircle(16, 16, 4, 255, 255, 255, 255);
  for (let d = -12; d <= 12; d++) {
    c.setPixel(16 + d, 16, 255, 255, 255, 255);
    c.setPixel(16, 16 + d, 255, 255, 255, 255);
  }
  c.saveToFile(path.join(OUT_DIR, 'particles/sparkle.png'));
}

// 5.4 Luminous Firefly (firefly.png - 28 x 28)
{
  const c = new Canvas(28, 28);
  c.drawRadialGlow(14, 14, 12, 180, 255, 80, 200);
  c.fillCircle(14, 14, 3.5, 240, 255, 200, 255);
  c.saveToFile(path.join(OUT_DIR, 'particles/firefly.png'));
}

// 5.5 Golden Coin Star (gold_star.png - 24 x 24)
{
  const c = new Canvas(24, 24);
  c.fillCircle(12, 12, 10, 255, 195, 20, 255);
  c.fillCircle(12, 12, 7, 255, 225, 60, 255);
  c.saveToFile(path.join(OUT_DIR, 'particles/gold_star.png'));
}

console.log('🎉 All 50+ Production Art Assets Generated Successfully in frontend/public/game/farm/!');
