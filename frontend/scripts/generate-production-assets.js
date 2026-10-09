/**
 * AVORA ENCHANTED FARM - PRODUCTION ASSET GENERATOR (SVG -> PNG VIA SHARP)
 * Produces ultra-crisp, hand-painted style 2.5D isometric game art assets
 * for plots, crops, mutations, terrain, and props matching Honor of Kings / Hay Day standard.
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const BASE_DIR = path.resolve(__dirname, '../public/game/farm');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function renderSvg(svgString, destPath, width, height) {
  ensureDir(path.dirname(destPath));
  const buffer = Buffer.from(svgString);
  await sharp(buffer)
    .resize(width, height)
    .png({ quality: 95 })
    .toFile(destPath);
  console.log(`  ✓ Created: ${path.relative(BASE_DIR, destPath)} (${width}x${height})`);
}

// ==========================================
// 1. ORGANIC FARM PLOTS (140 x 90)
// ==========================================
function getPlotSvg(type) {
  const w = 140;
  const h = 90;

  // Base diamond coordinates with smooth curved corners
  const pathD = `
    M 70,12 
    Q 128,42 132,47 
    Q 128,52 70,82 
    Q 12,52 8,47 
    Q 12,42 70,12 Z
  `;

  // Contact shadow path (larger blurred footprint underneath)
  const shadowD = `
    M 70,22 
    Q 134,50 138,55 
    Q 134,60 70,88 
    Q 6,60 2,55 
    Q 6,50 70,22 Z
  `;

  if (type === 'empty') {
    return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Contact shadow -->
        <filter id="blurShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <!-- Soil gradient -->
        <linearGradient id="soilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ab7a52" />
          <stop offset="40%" stop-color="#8d5b36" />
          <stop offset="100%" stop-color="#693e22" />
        </linearGradient>
        <!-- Rim highlight -->
        <linearGradient id="rimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#c69a74" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#553018" stop-opacity="0.3" />
        </linearGradient>
      </defs>

      <!-- Soft ambient shadow on grass -->
      <path d="${shadowD}" fill="rgba(25, 45, 20, 0.35)" filter="url(#blurShadow)" />

      <!-- 3D Bevel Base (rim thickness) -->
      <path d="M 70,14 Q 130,44 134,49 L 134,55 Q 128,60 70,88 Q 12,60 6,55 L 6,49 Q 10,44 70,14 Z" fill="#52311b" />

      <!-- Top Soil Surface -->
      <path d="${pathD}" fill="url(#soilGrad)" stroke="url(#rimGrad)" stroke-width="2" />

      <!-- Furrow ridges & soil texture -->
      <path d="M 45,30 Q 70,44 95,58" stroke="#5d3920" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.65" />
      <path d="M 32,40 Q 70,60 108,80" stroke="#5d3920" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5" />
      <path d="M 58,22 Q 80,34 102,46" stroke="#5d3920" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5" />

      <!-- Highlight clods -->
      <ellipse cx="65" cy="40" rx="3" ry="1.5" fill="#bd906b" opacity="0.8" />
      <ellipse cx="85" cy="48" rx="4" ry="2" fill="#bd906b" opacity="0.7" />
      <ellipse cx="48" cy="45" rx="3.5" ry="1.8" fill="#502c15" opacity="0.6" />
      <ellipse cx="98" cy="38" rx="2.5" ry="1.2" fill="#502c15" opacity="0.6" />

      <!-- Little green grass blades creeping over edge -->
      <path d="M 12,44 Q 14,39 17,42 Q 15,44 12,44 Z" fill="#8bc34a" />
      <path d="M 125,50 Q 128,45 130,48 Q 128,52 125,50 Z" fill="#7cb342" />
    </svg>`;
  }

  if (type === 'watered') {
    return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="blurShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id="wetSoilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5a4230" />
          <stop offset="50%" stop-color="#3d2a1c" />
          <stop offset="100%" stop-color="#2a1b11" />
        </linearGradient>
        <linearGradient id="waterSheen" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="#64b5f6" stop-opacity="0.4" />
          <stop offset="50%" stop-color="#e0f7fa" stop-opacity="0.7" />
          <stop offset="100%" stop-color="#26c6da" stop-opacity="0.2" />
        </linearGradient>
      </defs>

      <path d="${shadowD}" fill="rgba(15, 35, 20, 0.45)" filter="url(#blurShadow)" />
      <path d="M 70,14 Q 130,44 134,49 L 134,55 Q 128,60 70,88 Q 12,60 6,55 L 6,49 Q 10,44 70,14 Z" fill="#24150c" />
      <path d="${pathD}" fill="url(#wetSoilGrad)" stroke="#6d513d" stroke-width="1.8" />

      <!-- Wet puddles reflecting sunlight -->
      <ellipse cx="62" cy="42" rx="18" ry="8" fill="url(#waterSheen)" />
      <ellipse cx="85" cy="50" rx="14" ry="6" fill="url(#waterSheen)" />
      <ellipse cx="45" cy="35" rx="10" ry="5" fill="url(#waterSheen)" />

      <!-- Sparkle glints on water -->
      <circle cx="68" cy="40" r="1.5" fill="#ffffff" />
      <circle cx="82" cy="48" r="1.2" fill="#ffffff" />
    </svg>`;
  }

  if (type === 'ready') {
    return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="goldAura" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="readyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c48a58" />
          <stop offset="50%" stop-color="#996033" />
          <stop offset="100%" stop-color="#6e3e1a" />
        </linearGradient>
        <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffe082" />
          <stop offset="50%" stop-color="#ffb300" />
          <stop offset="100%" stop-color="#ff8f00" />
        </linearGradient>
      </defs>

      <!-- Golden harvest aura around plot -->
      <path d="${pathD}" fill="none" stroke="#ffca28" stroke-width="6" opacity="0.45" filter="url(#goldAura)" />
      <path d="${pathD}" fill="url(#readyGrad)" stroke="url(#goldBorder)" stroke-width="2.5" />

      <!-- Furrow lines -->
      <path d="M 45,30 Q 70,44 95,58" stroke="#5d3920" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5" />
      <path d="M 32,40 Q 70,60 108,80" stroke="#5d3920" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.4" />

      <!-- Golden sparkle stars -->
      <polygon points="35,28 37,33 42,35 37,37 35,42 33,37 28,35 33,33" fill="#fff9c4" opacity="0.9" />
      <polygon points="105,52 106.5,56 110.5,57.5 106.5,59 105,63 103.5,59 99.5,57.5 103.5,56" fill="#ffe082" opacity="0.9" />
    </svg>`;
  }

  // LOCKED MEADOW TILE: Natural wild meadow with flowers, pebbles, clover. NO ugly gray lock!
  if (type === 'locked') {
    return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="meadowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#aed581" />
          <stop offset="40%" stop-color="#8bc34a" />
          <stop offset="100%" stop-color="#689f38" />
        </linearGradient>
        <filter id="softShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(20,40,15,0.25)" />
        </filter>
      </defs>

      <!-- Soft meadow mound -->
      <path d="${pathD}" fill="url(#meadowGrad)" filter="url(#softShadow)" />

      <!-- Wild Clover clumps -->
      <circle cx="50" cy="40" r="4" fill="#7cb342" />
      <circle cx="54" cy="38" r="4" fill="#689f38" />
      <circle cx="52" cy="43" r="4" fill="#9ccc65" />

      <circle cx="95" cy="52" r="3.5" fill="#7cb342" />
      <circle cx="98" cy="50" r="3.5" fill="#689f38" />
      <circle cx="96" cy="55" r="3.5" fill="#9ccc65" />

      <!-- Smooth river stones / pebbles -->
      <ellipse cx="38" cy="48" rx="6" ry="3.5" fill="#b0bec5" stroke="#78909c" stroke-width="0.8" />
      <ellipse cx="44" cy="52" rx="4" ry="2.5" fill="#cfd8dc" stroke="#90a4ae" stroke-width="0.8" />
      <ellipse cx="88" cy="36" rx="5" ry="3" fill="#90a4ae" stroke="#607d8b" stroke-width="0.8" />

      <!-- Wild Daisy flowers (white with yellow center) -->
      <!-- Flower 1 -->
      <circle cx="70" cy="38" r="2" fill="#fff" />
      <circle cx="74" cy="38" r="2" fill="#fff" />
      <circle cx="72" cy="35" r="2" fill="#fff" />
      <circle cx="72" cy="41" r="2" fill="#fff" />
      <circle cx="72" cy="38" r="1.8" fill="#fbc02d" />

      <!-- Flower 2 (Pink clover) -->
      <circle cx="82" cy="46" r="1.8" fill="#f48fb1" />
      <circle cx="85" cy="45" r="1.8" fill="#f06292" />
      <circle cx="83" cy="48" r="1.8" fill="#f8bbd0" />
      <circle cx="83.5" cy="46.5" r="1.2" fill="#ad1457" />

      <!-- Flower 3 -->
      <circle cx="58" cy="55" r="1.5" fill="#fff" />
      <circle cx="61" cy="55" r="1.5" fill="#fff" />
      <circle cx="59.5" cy="53" r="1.5" fill="#fff" />
      <circle cx="59.5" cy="57" r="1.5" fill="#fff" />
      <circle cx="59.5" cy="55" r="1.2" fill="#fbc02d" />

      <!-- Subtle dew drops -->
      <circle cx="68" cy="32" r="1" fill="#e0f7fa" opacity="0.9" />
      <circle cx="76" cy="48" r="0.9" fill="#e0f7fa" opacity="0.9" />
    </svg>`;
  }

  return '';
}

// ==========================================
// 2. ENVIRONMENT & PROPS
// ==========================================

// Rustic Wooden Fence with Fairy String Lights (Inspired by Ref Image 1 & 2)
function getGardenFenceSvg() {
  return `
  <svg width="128" height="80" viewBox="0 0 128 80" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="woodPost" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#bcaaa4" />
        <stop offset="35%" stop-color="#8d6e63" />
        <stop offset="100%" stop-color="#5d4037" />
      </linearGradient>
      <linearGradient id="woodRail" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#a1887f" />
        <stop offset="100%" stop-color="#6d4c41" />
      </linearGradient>
      <filter id="lightGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" />
      </filter>
    </defs>

    <!-- Post 1 (Left) -->
    <polygon points="18,30 26,26 26,72 18,76" fill="url(#woodPost)" />
    <polygon points="18,30 22,24 30,22 26,26" fill="#d7ccc8" />

    <!-- Post 2 (Right) -->
    <polygon points="98,15 106,11 106,57 98,61" fill="url(#woodPost)" />
    <polygon points="98,15 102,9 110,7 106,11" fill="#d7ccc8" />

    <!-- Top Rail -->
    <polygon points="22,38 102,19 102,26 22,45" fill="url(#woodRail)" />
    <!-- Bottom Rail -->
    <polygon points="22,54 102,35 102,42 22,61" fill="url(#woodRail)" />

    <!-- Draped Fairy Light Wire -->
    <path d="M 24,39 Q 62,50 102,20" stroke="#424242" stroke-width="1.2" fill="none" />

    <!-- Glowing Fairy Light Bulbs -->
    <!-- Bulb 1 -->
    <circle cx="38" cy="43" r="4.5" fill="#ffe082" opacity="0.6" filter="url(#lightGlow)" />
    <circle cx="38" cy="43" r="2.2" fill="#fff9c4" />

    <!-- Bulb 2 -->
    <circle cx="54" cy="46" r="4.5" fill="#ffe082" opacity="0.6" filter="url(#lightGlow)" />
    <circle cx="54" cy="46" r="2.2" fill="#fff9c4" />

    <!-- Bulb 3 -->
    <circle cx="70" cy="44" r="4.5" fill="#ffe082" opacity="0.6" filter="url(#lightGlow)" />
    <circle cx="70" cy="44" r="2.2" fill="#fff9c4" />

    <!-- Bulb 4 -->
    <circle cx="86" cy="36" r="4.5" fill="#ffe082" opacity="0.6" filter="url(#lightGlow)" />
    <circle cx="86" cy="36" r="2.2" fill="#fff9c4" />

    <!-- Climbing pink flower vine at post base -->
    <circle cx="21" cy="70" r="3" fill="#f48fb1" />
    <circle cx="25" cy="67" r="2.5" fill="#f06292" />
    <circle cx="18" cy="68" r="2" fill="#8bc34a" />
  </svg>`;
}

// Japanese Vermilion Torii Gate
function getToriiGateSvg() {
  return `
  <svg width="128" height="160" viewBox="0 0 128 160" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="toriiRed" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ef5350" />
        <stop offset="40%" stop-color="#d32f2f" />
        <stop offset="100%" stop-color="#b71c1c" />
      </linearGradient>
      <linearGradient id="blackRoof" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#37474f" />
        <stop offset="100%" stop-color="#212121" />
      </linearGradient>
    </defs>

    <!-- Base Stones -->
    <polygon points="26,145 42,141 42,153 26,157" fill="#78909c" />
    <polygon points="86,129 102,125 102,137 86,141" fill="#78909c" />

    <!-- Left Pillar -->
    <polygon points="30,45 38,43 38,145 30,147" fill="url(#toriiRed)" />
    <!-- Right Pillar -->
    <polygon points="90,29 98,27 98,129 90,131" fill="url(#toriiRed)" />

    <!-- Lower Crossbeam (Nuki) -->
    <polygon points="20,62 108,40 108,47 20,69" fill="url(#toriiRed)" />

    <!-- Upper Curved Lintels (Kasagi & Shimaki) -->
    <path d="M 12,38 Q 64,30 116,17 L 116,24 Q 64,37 12,45 Z" fill="url(#toriiRed)" />
    <!-- Black curved roof cap -->
    <path d="M 8,36 Q 64,26 120,13 L 122,17 Q 64,30 10,40 Z" fill="url(#blackRoof)" />

    <!-- AVORA Gold Plaque in Center -->
    <rect x="60" y="38" width="8" height="14" rx="1" fill="#ffb300" stroke="#ffe082" stroke-width="0.8" />
  </svg>`;
}

// Japanese Stone Lantern (Toro) with Warm Glowing Candle
function getStoneLanternSvg() {
  return `
  <svg width="64" height="112" viewBox="0 0 64 112" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="stoneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#cfd8dc" />
        <stop offset="40%" stop-color="#90a4ae" />
        <stop offset="100%" stop-color="#546e7a" />
      </linearGradient>
      <filter id="candleGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>

    <!-- Base Pedestal -->
    <polygon points="18,92 46,85 46,104 18,111" fill="url(#stoneGrad)" />

    <!-- Central Pillar -->
    <polygon points="28,68 36,66 36,92 28,94" fill="url(#stoneGrad)" />

    <!-- Lantern Light Chamber (Warm Amber Glow) -->
    <rect x="22" y="44" width="20" height="22" rx="2" fill="#ff8f00" filter="url(#candleGlow)" />
    <rect x="24" y="46" width="16" height="18" rx="1" fill="#fff8e1" />
    <!-- Wooden Lattice Bars -->
    <line x1="32" y1="46" x2="32" y2="64" stroke="#546e7a" stroke-width="2" />
    <line x1="24" y1="55" x2="40" y2="55" stroke="#546e7a" stroke-width="2" />

    <!-- Pagoda Hexagonal Roof -->
    <polygon points="12,44 52,34 46,26 18,34" fill="url(#stoneGrad)" />
    <path d="M 8,45 Q 32,38 56,29 L 52,32 Q 32,41 12,48 Z" fill="#455a64" />

    <!-- Top Jewel Finial -->
    <ellipse cx="32" cy="22" rx="4" ry="5" fill="url(#stoneGrad)" />

    <!-- Moss accents -->
    <circle cx="16" cy="44" r="2.5" fill="#8bc34a" />
    <circle cx="20" cy="94" r="3" fill="#7cb342" />
  </svg>`;
}

// Curved Red Wooden Bridge
function getWoodenBridgeSvg() {
  return `
  <svg width="128" height="96" viewBox="0 0 128 96" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bridgeRed" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ef5350" />
        <stop offset="100%" stop-color="#b71c1c" />
      </linearGradient>
    </defs>

    <!-- Arched Bridge Base Deck -->
    <path d="M 12,68 Q 64,36 116,50 L 116,62 Q 64,48 12,80 Z" fill="#8d6e63" />
    <path d="M 12,65 Q 64,33 116,47 L 116,54 Q 64,40 12,72 Z" fill="#bcaaa4" />

    <!-- Red Curved Handrails -->
    <path d="M 12,50 Q 64,18 116,32 L 116,37 Q 64,23 12,55 Z" fill="url(#bridgeRed)" />

    <!-- Vertical Balusters -->
    <line x1="28" y1="46" x2="28" y2="68" stroke="url(#bridgeRed)" stroke-width="3" />
    <line x1="48" y1="36" x2="48" y2="58" stroke="url(#bridgeRed)" stroke-width="3" />
    <line x1="68" y1="31" x2="68" y2="51" stroke="url(#bridgeRed)" stroke-width="3" />
    <line x1="88" y1="30" x2="88" y2="51" stroke="url(#bridgeRed)" stroke-width="3" />
    <line x1="104" y1="33" x2="104" y2="53" stroke="url(#bridgeRed)" stroke-width="3" />
  </svg>`;
}

// Stepping Stone Path Tile
function getStonePathSvg() {
  return `
  <svg width="128" height="64" viewBox="0 0 128 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="stone" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e0e0e0" />
        <stop offset="50%" stop-color="#b0bec5" />
        <stop offset="100%" stop-color="#78909c" />
      </linearGradient>
    </defs>
    <!-- Flagstone 1 -->
    <ellipse cx="42" cy="28" rx="16" ry="9" fill="url(#stone)" stroke="#546e7a" stroke-width="1" />
    <!-- Flagstone 2 -->
    <ellipse cx="76" cy="36" rx="18" ry="10" fill="url(#stone)" stroke="#546e7a" stroke-width="1" />
    <!-- Flagstone 3 -->
    <ellipse cx="56" cy="46" rx="14" ry="8" fill="url(#stone)" stroke="#546e7a" stroke-width="1" />
    <!-- Moss tufts -->
    <circle cx="58" cy="34" r="2.5" fill="#8bc34a" />
    <circle cx="64" cy="40" r="2" fill="#7cb342" />
  </svg>`;
}

// Sparkling Koi Stream Tile
function getWaterStreamSvg() {
  return `
  <svg width="128" height="64" viewBox="0 0 128 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="water" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#80deea" />
        <stop offset="50%" stop-color="#26c6da" />
        <stop offset="100%" stop-color="#00838f" />
      </linearGradient>
    </defs>
    <!-- Stream surface -->
    <path d="M 64,6 Q 120,30 124,32 Q 120,34 64,58 Q 8,34 4,32 Q 8,30 64,6 Z" fill="url(#water)" />

    <!-- Water ripples -->
    <path d="M 40,24 Q 64,32 88,24" stroke="#e0f7fa" stroke-width="1.5" fill="none" opacity="0.8" />
    <path d="M 30,34 Q 64,44 98,34" stroke="#e0f7fa" stroke-width="1.2" fill="none" opacity="0.7" />

    <!-- Lily Pad -->
    <ellipse cx="50" cy="30" rx="8" ry="4.5" fill="#66bb6a" stroke="#388e3c" stroke-width="0.8" />
    <circle cx="53" cy="29" r="1.5" fill="#f48fb1" />

    <!-- Orange Koi Fish silhouette underwater -->
    <ellipse cx="78" cy="38" rx="6" ry="2.2" fill="#ff7043" opacity="0.75" />
    <polygon points="84,38 88,35 88,41" fill="#ff7043" opacity="0.6" />
  </svg>`;
}

// Circular Action Harvest Badge (Purple badge with White Hand as in Ref Image 2)
function getHarvestBadgeSvg() {
  return `
  <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7e57c2" />
        <stop offset="100%" stop-color="#4527a0" />
      </linearGradient>
      <linearGradient id="badgeGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff59d" />
        <stop offset="100%" stop-color="#fbc02d" />
      </linearGradient>
      <filter id="badgeShadow">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)" />
      </filter>
    </defs>
    <!-- Outer circle -->
    <circle cx="32" cy="32" r="26" fill="url(#badgeGrad)" stroke="url(#badgeGold)" stroke-width="3" filter="url(#badgeShadow)" />
    <!-- White Harvesting Hand Icon -->
    <path d="M 24,34 C 24,30 27,27 30,27 C 31,27 32,28 32.5,29 C 33,28 34,27 35.5,27 C 36.5,27 37.5,28 38,29 C 38.5,28 39.5,27.5 40.5,28 C 42,28.5 42.5,30 42.5,32 C 42.5,37 38,42 33,42 C 28,42 24,38 24,34 Z" fill="#ffffff" />
    <!-- Infinite sparkle -->
    <circle cx="39" cy="35" r="1.5" fill="#7e57c2" />
  </svg>`;
}

// ==========================================
// 3. PARTICLES
// ==========================================
function getParticleSvg(type) {
  if (type === 'petal') {
    return `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sakuraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffcdd2" />
          <stop offset="50%" stop-color="#f48fb1" />
          <stop offset="100%" stop-color="#f06292" />
        </linearGradient>
      </defs>
      <path d="M 16,4 C 22,4 28,10 26,18 C 24,26 18,28 16,28 C 14,28 8,26 6,18 C 4,10 10,4 16,4 Z" fill="url(#sakuraGrad)" />
    </svg>`;
  }

  if (type === 'firefly') {
    return `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="fireflyAura">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="30%" stop-color="#fff59d" />
          <stop offset="70%" stop-color="#ffb300" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#ff8f00" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#fireflyAura)" />
      <circle cx="16" cy="16" r="3" fill="#ffffff" />
    </svg>`;
  }

  if (type === 'sparkle') {
    return `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,2 19,13 30,16 19,19 16,30 13,19 2,16 13,13" fill="#fff59d" />
      <circle cx="16" cy="16" r="3" fill="#ffffff" />
    </svg>`;
  }

  if (type === 'gold_star') {
    return `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="starGold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fff59d" />
          <stop offset="50%" stop-color="#ffca28" />
          <stop offset="100%" stop-color="#ff8f00" />
        </linearGradient>
      </defs>
      <polygon points="16,3 20,11 29,12 22,18 24,27 16,22 8,27 10,18 3,12 12,11" fill="url(#starGold)" stroke="#ffa000" stroke-width="1" />
    </svg>`;
  }

  return '';
}

// ==========================================
// 4. CROPS & MUTATIONS
// ==========================================

// Helper: Rustic wooden vertical stake (as in Ref Image 1)
const WOODEN_STAKE_SVG = `
  <polygon points="61,12 67,10 67,126 61,128" fill="#8d6e63" />
  <polygon points="61,12 64,8 70,6 67,10" fill="#bcaaa4" />
`;

function getCropSvg(crop, stage) {
  const w = 128;
  const h = 136;

  // 1. JAPANESE RICE / SUNFLOWER HYBRID (Reference 1 & 2 inspired)
  if (crop === 'rice') {
    if (stage === 0) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <ellipse cx="64" cy="115" rx="5" ry="3" fill="#ffe082" stroke="#ffb300" stroke-width="1" />
        <path d="M 64,113 Q 66,106 68,102" stroke="#8bc34a" stroke-width="2" stroke-linecap="round" fill="none" />
      </svg>`;
    }
    if (stage === 1) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <path d="M 64,120 Q 62,95 56,86" stroke="#7cb342" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M 64,120 Q 67,100 74,90" stroke="#8bc34a" stroke-width="3" stroke-linecap="round" fill="none" />
      </svg>`;
    }
    if (stage === 2) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <path d="M 64,122 Q 58,90 44,70" stroke="#689f38" stroke-width="3.5" stroke-linecap="round" fill="none" />
        <path d="M 64,122 Q 64,85 64,65" stroke="#7cb342" stroke-width="4" stroke-linecap="round" fill="none" />
        <path d="M 64,122 Q 70,90 84,72" stroke="#8bc34a" stroke-width="3.5" stroke-linecap="round" fill="none" />
      </svg>`;
    }
    if (stage === 3) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <path d="M 64,124 Q 54,80 40,55" stroke="#689f38" stroke-width="4" stroke-linecap="round" fill="none" />
        <path d="M 64,124 Q 64,75 64,50" stroke="#7cb342" stroke-width="4.5" stroke-linecap="round" fill="none" />
        <path d="M 64,124 Q 74,80 88,58" stroke="#8bc34a" stroke-width="4" stroke-linecap="round" fill="none" />
        <!-- Developing green ears -->
        <ellipse cx="40" cy="53" rx="6" ry="12" transform="rotate(-30 40 53)" fill="#aed581" />
        <ellipse cx="64" cy="48" rx="6" ry="14" fill="#aed581" />
        <ellipse cx="88" cy="56" rx="6" ry="12" transform="rotate(30 88 56)" fill="#aed581" />
      </svg>`;
    }
    if (stage === 4) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <path d="M 64,124 Q 54,80 36,52" stroke="#689f38" stroke-width="4" stroke-linecap="round" fill="none" />
        <path d="M 64,124 Q 64,75 64,45" stroke="#7cb342" stroke-width="4.5" stroke-linecap="round" fill="none" />
        <path d="M 64,124 Q 74,80 92,54" stroke="#8bc34a" stroke-width="4" stroke-linecap="round" fill="none" />
        <!-- Golden-yellow grain heads drooping -->
        <ellipse cx="34" cy="52" rx="8" ry="16" transform="rotate(-35 34 52)" fill="#ffd54f" stroke="#ffb300" stroke-width="1" />
        <ellipse cx="64" cy="42" rx="9" ry="18" fill="#ffd54f" stroke="#ffb300" stroke-width="1" />
        <ellipse cx="94" cy="54" rx="8" ry="16" transform="rotate(35 94 54)" fill="#ffd54f" stroke="#ffb300" stroke-width="1" />
      </svg>`;
    }
    // Stage 5: Ready Golden Harvest Sheaf (or Sunflower as seen in Ref Image 2)
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <radialGradient id="goldGrain">
          <stop offset="0%" stop-color="#fff9c4" />
          <stop offset="60%" stop-color="#fbc02d" />
          <stop offset="100%" stop-color="#f57f17" />
        </radialGradient>
      </defs>
      <!-- Big healthy stalks & leaves -->
      <path d="M 64,126 Q 52,80 30,50" stroke="#558b2f" stroke-width="4.5" stroke-linecap="round" fill="none" />
      <path d="M 64,126 Q 64,70 64,35" stroke="#689f38" stroke-width="5" stroke-linecap="round" fill="none" />
      <path d="M 64,126 Q 76,80 98,52" stroke="#558b2f" stroke-width="4.5" stroke-linecap="round" fill="none" />

      <!-- Broad leaves -->
      <path d="M 64,95 Q 40,85 32,95 C 44,100 56,98 64,95 Z" fill="#7cb342" />
      <path d="M 64,85 Q 88,75 96,85 C 84,90 72,88 64,85 Z" fill="#7cb342" />

      <!-- Heavy drooping golden sheaf clusters -->
      <ellipse cx="28" cy="52" rx="10" ry="22" transform="rotate(-40 28 52)" fill="url(#goldGrain)" stroke="#f57f17" stroke-width="1.5" />
      <ellipse cx="64" cy="34" rx="12" ry="26" fill="url(#goldGrain)" stroke="#f57f17" stroke-width="1.5" />
      <ellipse cx="100" cy="54" rx="10" ry="22" transform="rotate(40 100 54)" fill="url(#goldGrain)" stroke="#f57f17" stroke-width="1.5" />

      <!-- Sparkle on ready crop -->
      <polygon points="64,12 66,20 74,22 66,24 64,32 62,24 54,22 62,20" fill="#ffffff" />
    </svg>`;
  }

  // 2. KYOHO GRAPES ON WOODEN STAKE (Directly from Ref Image 1!)
  if (crop === 'grape') {
    if (stage === 0) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        ${WOODEN_STAKE_SVG}
        <ellipse cx="64" cy="118" rx="4" ry="2.5" fill="#5d4037" />
        <path d="M 64,116 Q 60,105 58,98" stroke="#8bc34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </svg>`;
    }
    if (stage === 1) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        ${WOODEN_STAKE_SVG}
        <!-- Vine twining -->
        <path d="M 64,124 Q 60,100 68,85 Q 60,70 64,55" stroke="#689f38" stroke-width="3" stroke-linecap="round" fill="none" />
        <circle cx="58" cy="80" r="6" fill="#8bc34a" />
      </svg>`;
    }
    if (stage === 2) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        ${WOODEN_STAKE_SVG}
        <path d="M 64,124 Q 58,95 68,75 Q 58,55 64,35" stroke="#558b2f" stroke-width="3.5" stroke-linecap="round" fill="none" />
        <!-- Big grape leaves -->
        <circle cx="54" cy="70" r="11" fill="#7cb342" />
        <circle cx="76" cy="58" r="12" fill="#8bc34a" />
        <circle cx="58" cy="44" r="10" fill="#689f38" />
      </svg>`;
    }
    if (stage === 3) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        ${WOODEN_STAKE_SVG}
        <circle cx="54" cy="65" r="12" fill="#7cb342" />
        <circle cx="76" cy="50" r="13" fill="#8bc34a" />
        <!-- Small green grape bunch -->
        <circle cx="64" cy="72" r="5" fill="#aed581" />
        <circle cx="70" cy="75" r="5" fill="#aed581" />
        <circle cx="58" cy="76" r="5" fill="#9ccc65" />
        <circle cx="64" cy="82" r="5" fill="#9ccc65" />
      </svg>`;
    }
    if (stage === 4) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        ${WOODEN_STAKE_SVG}
        <circle cx="52" cy="55" r="14" fill="#689f38" />
        <circle cx="78" cy="45" r="15" fill="#7cb342" />
        <!-- Cluster turning purple/amber -->
        <g stroke="#4a148c" stroke-width="0.8">
          <circle cx="60" cy="68" r="6.5" fill="#9575cd" />
          <circle cx="72" cy="69" r="6.5" fill="#7e57c2" />
          <circle cx="55" cy="78" r="6.5" fill="#673ab7" />
          <circle cx="67" cy="80" r="7" fill="#5e35b1" />
          <circle cx="77" cy="79" r="6" fill="#7e57c2" />
          <circle cx="62" cy="90" r="6.5" fill="#512da8" />
          <circle cx="72" cy="91" r="6" fill="#4527a0" />
          <circle cx="66" cy="100" r="5.5" fill="#311b92" />
        </g>
      </svg>`;
    }
    // Stage 5: Ready Kyoho Grapes on Wooden Stake (Ref Image 1 replica!)
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <radialGradient id="grapeShine" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#e1bee7" />
          <stop offset="40%" stop-color="#8e24aa" />
          <stop offset="90%" stop-color="#4a148c" />
          <stop offset="100%" stop-color="#12005e" />
        </radialGradient>
      </defs>
      ${WOODEN_STAKE_SVG}

      <!-- Top foliage & tendrils -->
      <circle cx="50" cy="40" r="16" fill="#558b2f" />
      <circle cx="78" cy="35" r="18" fill="#689f38" />
      <circle cx="64" cy="25" r="14" fill="#7cb342" />

      <!-- Big heavy cluster of luscious Kyoho grapes -->
      <g stroke="#311b92" stroke-width="1">
        <!-- Row 1 -->
        <circle cx="56" cy="56" r="8" fill="url(#grapeShine)" />
        <circle cx="72" cy="57" r="8" fill="url(#grapeShine)" />
        <!-- Row 2 -->
        <circle cx="48" cy="69" r="8" fill="url(#grapeShine)" />
        <circle cx="64" cy="70" r="8.5" fill="url(#grapeShine)" />
        <circle cx="80" cy="69" r="8" fill="url(#grapeShine)" />
        <!-- Row 3 -->
        <circle cx="54" cy="83" r="8" fill="url(#grapeShine)" />
        <circle cx="72" cy="84" r="8.5" fill="url(#grapeShine)" />
        <circle cx="86" cy="82" r="7.5" fill="url(#grapeShine)" />
        <!-- Row 4 -->
        <circle cx="60" cy="96" r="8" fill="url(#grapeShine)" />
        <circle cx="76" cy="97" r="7.5" fill="url(#grapeShine)" />
        <!-- Tip -->
        <circle cx="68" cy="108" r="7" fill="url(#grapeShine)" />
      </g>

      <!-- Glossy white highlight on main grapes -->
      <circle cx="62" cy="67" r="2.2" fill="#ffffff" opacity="0.8" />
      <circle cx="70" cy="81" r="2.2" fill="#ffffff" opacity="0.8" />
      <circle cx="58" cy="93" r="2.0" fill="#ffffff" opacity="0.8" />
    </svg>`;
  }

  // 3. TOCHIGI STRAWBERRY
  if (crop === 'strawberry') {
    if (stage === 0) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <ellipse cx="64" cy="118" rx="4" ry="2.5" fill="#8d6e63" />
        <path d="M 64,116 Q 62,108 60,102" stroke="#8bc34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </svg>`;
    }
    if (stage < 3) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <circle cx="54" cy="100" r="9" fill="#7cb342" />
        <circle cx="74" cy="98" r="9" fill="#8bc34a" />
        <circle cx="64" cy="90" r="10" fill="#689f38" />
        <!-- Little white flower -->
        <circle cx="64" cy="85" r="3" fill="#ffffff" />
        <circle cx="64" cy="85" r="1.2" fill="#fbc02d" />
      </svg>`;
    }
    if (stage === 3 || stage === 4) {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <circle cx="48" cy="95" r="12" fill="#689f38" />
        <circle cx="80" cy="92" r="12" fill="#7cb342" />
        <circle cx="64" cy="80" r="14" fill="#558b2f" />
        <!-- Blushing strawberry -->
        <path d="M 56,100 C 56,88 72,88 72,100 C 72,112 64,118 64,118 C 64,118 56,112 56,100 Z" fill="#ff7043" stroke="#d84315" stroke-width="1" />
      </svg>`;
    }
    // Stage 5: Plump Crimson Glossy Strawberry
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <radialGradient id="berryRed" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#ff8a80" />
          <stop offset="40%" stop-color="#d50000" />
          <stop offset="100%" stop-color="#8b0000" />
        </radialGradient>
      </defs>
      <!-- Bush foliage -->
      <circle cx="42" cy="85" r="15" fill="#558b2f" />
      <circle cx="86" cy="82" r="15" fill="#689f38" />
      <circle cx="64" cy="65" r="18" fill="#7cb342" />

      <!-- Giant ripe strawberry (Center) -->
      <path d="M 50,85 C 50,68 78,68 78,85 C 78,105 64,116 64,116 C 64,116 50,105 50,85 Z" fill="url(#berryRed)" stroke="#b71c1c" stroke-width="1.5" />
      <!-- Calyx leaves -->
      <polygon points="64,74 54,68 62,72 64,62 66,72 74,68" fill="#4caf50" />

      <!-- Yellow seeds -->
      <circle cx="58" cy="84" r="1" fill="#fff59d" />
      <circle cx="70" cy="84" r="1" fill="#fff59d" />
      <circle cx="64" cy="92" r="1" fill="#fff59d" />
      <circle cx="58" cy="100" r="1" fill="#fff59d" />
      <circle cx="68" cy="100" r="1" fill="#fff59d" />
      <circle cx="64" cy="107" r="0.8" fill="#fff59d" />

      <!-- Dewdrop highlight -->
      <ellipse cx="58" cy="80" rx="3.5" ry="2" fill="#ffffff" opacity="0.85" />
    </svg>`;
  }

  // 4. UJI MATCHA (Tea Shrub)
  if (crop === 'matcha') {
    const size = 6 + stage * 3;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <radialGradient id="teaJade" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#aed581" />
          <stop offset="60%" stop-color="#43a047" />
          <stop offset="100%" stop-color="#1b5e20" />
        </radialGradient>
      </defs>
      <circle cx="64" cy="85" r="${size * 1.5}" fill="url(#teaJade)" stroke="#2e7d32" stroke-width="1.5" />
      ${stage >= 4 ? `
        <!-- Fresh top jade shoots -->
        <path d="M 64,55 Q 60,42 54,36 Q 62,40 64,55 Z" fill="#c5e1a5" />
        <path d="M 64,55 Q 68,42 74,36 Q 66,40 64,55 Z" fill="#dcedc8" />
      ` : ''}
    </svg>`;
  }

  // 5. SAKURA (Cherry Bonsai)
  if (crop === 'sakura') {
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <radialGradient id="sakuraCanopy" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fce4ec" />
          <stop offset="50%" stop-color="#f48fb1" />
          <stop offset="100%" stop-color="#ad1457" />
        </radialGradient>
      </defs>
      <!-- Bonsai trunk -->
      <path d="M 64,124 Q 60,95 68,75 Q 64,60 64,50" stroke="#5d4037" stroke-width="5" stroke-linecap="round" fill="none" />
      <!-- Sakura bloom clouds -->
      <circle cx="48" cy="55" r="${10 + stage * 2}" fill="url(#sakuraCanopy)" />
      <circle cx="80" cy="50" r="${11 + stage * 2}" fill="url(#sakuraCanopy)" />
      <circle cx="64" cy="40" r="${13 + stage * 2}" fill="url(#sakuraCanopy)" />
      <!-- Blossom details -->
      <circle cx="64" cy="38" r="2.5" fill="#ffffff" />
      <circle cx="78" cy="48" r="2" fill="#ffffff" />
    </svg>`;
  }

  // 6. YUZU CITRUS
  if (crop === 'yuzu') {
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <radialGradient id="yuzuGold" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#fffde7" />
          <stop offset="50%" stop-color="#ffd600" />
          <stop offset="100%" stop-color="#ff6f00" />
        </radialGradient>
      </defs>
      <!-- Tree bush -->
      <circle cx="50" cy="80" r="18" fill="#388e3c" />
      <circle cx="78" cy="78" r="18" fill="#43a047" />
      <circle cx="64" cy="62" r="22" fill="#4caf50" />
      ${stage >= 3 ? `
        <!-- Bright yellow Yuzu fruits -->
        <circle cx="52" cy="72" r="7" fill="url(#yuzuGold)" stroke="#f57f17" stroke-width="1" />
        <circle cx="76" cy="68" r="8" fill="url(#yuzuGold)" stroke="#f57f17" stroke-width="1" />
        <circle cx="64" cy="86" r="8.5" fill="url(#yuzuGold)" stroke="#f57f17" stroke-width="1" />
      ` : ''}
    </svg>`;
  }

  return '';
}

// 5. SIGNATURE MUTATIONS (3 Legendary Crops)
function getMutationSvg(type) {
  const w = 128;
  const h = 144;

  if (type === 'golden_grape') {
    return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="goldMet" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="30%" stop-color="#ffe082" />
          <stop offset="70%" stop-color="#ffb300" />
          <stop offset="100%" stop-color="#b26a00" />
        </radialGradient>
        <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      ${WOODEN_STAKE_SVG}

      <!-- Radiant golden aura behind -->
      <circle cx="68" cy="80" r="36" fill="#ffe082" opacity="0.35" filter="url(#goldGlow)" />

      <!-- Golden foliage -->
      <circle cx="50" cy="40" r="16" fill="#ffd54f" />
      <circle cx="78" cy="35" r="18" fill="#ffca28" />

      <!-- 24K Pure Gold Grapes -->
      <g stroke="#ff8f00" stroke-width="1.2">
        <circle cx="56" cy="56" r="8" fill="url(#goldMet)" />
        <circle cx="72" cy="57" r="8" fill="url(#goldMet)" />
        <circle cx="48" cy="69" r="8" fill="url(#goldMet)" />
        <circle cx="64" cy="70" r="9" fill="url(#goldMet)" />
        <circle cx="80" cy="69" r="8" fill="url(#goldMet)" />
        <circle cx="54" cy="83" r="8.5" fill="url(#goldMet)" />
        <circle cx="72" cy="84" r="9" fill="url(#goldMet)" />
        <circle cx="86" cy="82" r="8" fill="url(#goldMet)" />
        <circle cx="60" cy="97" r="8.5" fill="url(#goldMet)" />
        <circle cx="76" cy="98" r="8" fill="url(#goldMet)" />
        <circle cx="68" cy="110" r="7.5" fill="url(#goldMet)" />
      </g>

      <!-- 8-Point Starlight Sparkles -->
      <polygon points="40,65 42,69 46,70 42,71 40,75 38,71 34,70 38,69" fill="#ffffff" />
      <polygon points="90,80 92,84 96,85 92,86 90,90 88,86 84,85 88,84" fill="#ffffff" />
    </svg>`;
  }

  if (type === 'crystal_strawberry') {
    return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="iceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="40%" stop-color="#b2ebf2" />
          <stop offset="80%" stop-color="#4dd0e1" />
          <stop offset="100%" stop-color="#00838f" />
        </linearGradient>
        <filter id="iceGlow">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <!-- Crystal foliage -->
      <circle cx="42" cy="85" r="16" fill="#80deea" opacity="0.8" />
      <circle cx="86" cy="82" r="16" fill="#4dd0e1" opacity="0.8" />
      <circle cx="64" cy="65" r="18" fill="#e0f7fa" opacity="0.9" />

      <!-- Faceted Crystal Strawberry -->
      <path d="M 50,85 C 50,68 78,68 78,85 C 78,105 64,118 64,118 C 64,118 50,105 50,85 Z" fill="url(#iceGrad)" stroke="#00acc1" stroke-width="1.8" />

      <!-- Crystal Facet Lines -->
      <polygon points="64,74 54,88 64,96 74,88" fill="rgba(255,255,255,0.4)" stroke="#ffffff" stroke-width="1" />
      <polygon points="64,96 56,108 64,116 72,108" fill="rgba(255,255,255,0.3)" stroke="#ffffff" stroke-width="1" />

      <circle cx="64" cy="70" r="3" fill="#ffffff" filter="url(#iceGlow)" />
    </svg>`;
  }

  if (type === 'moonlight_sakura') {
    return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="moonGlow" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ede7f6" />
          <stop offset="50%" stop-color="#b39ddb" />
          <stop offset="90%" stop-color="#512da8" />
          <stop offset="100%" stop-color="#1a0056" />
        </radialGradient>
        <filter id="purpleAura">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <!-- Bioluminescent aura -->
      <circle cx="64" cy="60" r="40" fill="#7c4dff" opacity="0.4" filter="url(#purpleAura)" />

      <!-- Dark mysterious trunk -->
      <path d="M 64,130 Q 60,95 68,75 Q 64,60 64,50" stroke="#261b40" stroke-width="6" stroke-linecap="round" fill="none" />

      <!-- Glowing moon-violet canopies -->
      <circle cx="46" cy="55" r="22" fill="url(#moonGlow)" />
      <circle cx="82" cy="50" r="24" fill="url(#moonGlow)" />
      <circle cx="64" cy="40" r="26" fill="url(#moonGlow)" />

      <!-- Glowing stardust orbs -->
      <circle cx="52" cy="42" r="3" fill="#ffffff" />
      <circle cx="76" cy="52" r="2.5" fill="#b388ff" />
      <circle cx="64" cy="28" r="3" fill="#ffffff" />
    </svg>`;
  }

  return '';
}

// ==========================================
// MAIN EXECUTION ROUTINE
// ==========================================
async function main() {
  console.log('🚀 Starting AVORA Farm Production Asset Rendering Pipeline...');

  // 1. Organic Farm Plots
  console.log('\n--- 1. Rendering Organic Farm Plots ---');
  await renderSvg(getPlotSvg('empty'), path.join(BASE_DIR, 'environment/plots/tile_soil_empty.png'), 140, 90);
  await renderSvg(getPlotSvg('watered'), path.join(BASE_DIR, 'environment/plots/tile_soil_watered.png'), 140, 90);
  await renderSvg(getPlotSvg('ready'), path.join(BASE_DIR, 'environment/plots/tile_soil_ready.png'), 140, 90);
  await renderSvg(getPlotSvg('locked'), path.join(BASE_DIR, 'environment/plots/tile_locked_meadow.png'), 140, 90);

  // Backward compatibility alias keys
  await renderSvg(getPlotSvg('empty'), path.join(BASE_DIR, 'environment/plots/plot_empty.png'), 140, 90);
  await renderSvg(getPlotSvg('empty'), path.join(BASE_DIR, 'environment/plots/plot_plowed.png'), 140, 90);
  await renderSvg(getPlotSvg('watered'), path.join(BASE_DIR, 'environment/plots/plot_watered.png'), 140, 90);
  await renderSvg(getPlotSvg('ready'), path.join(BASE_DIR, 'environment/plots/plot_ready_glow.png'), 140, 90);
  await renderSvg(getPlotSvg('locked'), path.join(BASE_DIR, 'environment/plots/plot_locked_wild.png'), 140, 90);

  // 2. Terrain & Environment Props
  console.log('\n--- 2. Rendering Terrain & Environment Props ---');
  await renderSvg(getGardenFenceSvg(), path.join(BASE_DIR, 'environment/props/garden_fence.png'), 128, 80);
  await renderSvg(getToriiGateSvg(), path.join(BASE_DIR, 'environment/props/torii_gate.png'), 128, 160);
  await renderSvg(getStoneLanternSvg(), path.join(BASE_DIR, 'environment/props/stone_lantern.png'), 64, 112);
  await renderSvg(getWoodenBridgeSvg(), path.join(BASE_DIR, 'environment/props/wooden_bridge.png'), 128, 96);
  await renderSvg(getStonePathSvg(), path.join(BASE_DIR, 'environment/terrain/stone_path.png'), 128, 64);
  await renderSvg(getWaterStreamSvg(), path.join(BASE_DIR, 'environment/terrain/water_stream.png'), 128, 64);
  await renderSvg(getHarvestBadgeSvg(), path.join(BASE_DIR, 'environment/props/harvest_badge.png'), 64, 64);

  // Grass tile
  const grassSvg = `<svg width="128" height="64" viewBox="0 0 128 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M 64,2 Q 126,30 128,32 Q 126,34 64,62 Q 2,34 0,32 Q 2,30 64,2 Z" fill="#8bc34a" />
    <circle cx="50" cy="30" r="3" fill="#9ccc65" />
    <circle cx="78" cy="35" r="2.5" fill="#7cb342" />
  </svg>`;
  await renderSvg(grassSvg, path.join(BASE_DIR, 'environment/terrain/grass_tile.png'), 128, 64);

  // 3. Particles
  console.log('\n--- 3. Rendering Ambient Particles ---');
  await renderSvg(getParticleSvg('petal'), path.join(BASE_DIR, 'particles/petal.png'), 32, 32);
  await renderSvg(getParticleSvg('firefly'), path.join(BASE_DIR, 'particles/firefly.png'), 32, 32);
  await renderSvg(getParticleSvg('sparkle'), path.join(BASE_DIR, 'particles/sparkle.png'), 32, 32);
  await renderSvg(getParticleSvg('gold_star'), path.join(BASE_DIR, 'particles/gold_star.png'), 32, 32);
  const waterDropSvg = `<svg width="32" height="32" viewBox="0 0 32 32">
    <path d="M 16,4 C 16,4 6,18 6,24 A 10,10 0 0,0 26,24 C 26,18 16,4 16,4 Z" fill="#29b6f6" stroke="#0288d1" stroke-width="1.2" />
    <ellipse cx="13" cy="20" rx="3" ry="5" fill="#ffffff" opacity="0.65" />
  </svg>`;
  await renderSvg(waterDropSvg, path.join(BASE_DIR, 'particles/water_drop.png'), 32, 32);

  // 4. Crops (6 Crops x 6 Stages = 36 Assets)
  console.log('\n--- 4. Rendering 36 Crop Growth Stages ---');
  const crops = [
    { code: 'rice', folder: 'rice' },
    { code: 'strawberry', folder: 'strawberry' },
    { code: 'grape', folder: 'grape' },
    { code: 'matcha', folder: 'matcha' },
    { code: 'sakura', folder: 'sakura' },
    { code: 'yuzu', folder: 'yuzu' },
  ];

  for (const crop of crops) {
    for (let stage = 0; stage <= 5; stage++) {
      const svg = getCropSvg(crop.code, stage);
      const dest = path.join(BASE_DIR, `crops/${crop.folder}/stage_${stage}.png`);
      await renderSvg(svg, dest, 128, 136);
    }
  }

  // 5. Signature Mutations
  console.log('\n--- 5. Rendering 3 Signature Mutations ---');
  await renderSvg(getMutationSvg('golden_grape'), path.join(BASE_DIR, 'mutations/golden-grape/plant.png'), 128, 144);
  await renderSvg(getMutationSvg('crystal_strawberry'), path.join(BASE_DIR, 'mutations/crystal-strawberry/plant.png'), 128, 144);
  await renderSvg(getMutationSvg('moonlight_sakura'), path.join(BASE_DIR, 'mutations/moonlight-sakura/plant.png'), 128, 144);

  console.log('\n✨ ALL PRODUCTION ASSETS SUCCESSFULLY GENERATED!');
}

main().catch(err => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
