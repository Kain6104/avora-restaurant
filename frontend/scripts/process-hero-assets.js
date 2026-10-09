const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ARTIFACT_DIR = 'C:/Users/PHAT/.gemini/antigravity-ide/brain/248f5e6e-4b57-4c72-ad6d-8b61df7235cb';
const PUBLIC_DIR = path.resolve(__dirname, '../public/game/farm');

async function processSky() {
  const skySrc = path.join(ARTIFACT_DIR, 'env_sky_daylight_1789290649086.jpg');
  const skyDest = path.join(PUBLIC_DIR, 'environment/sky_daylight.png');
  fs.mkdirSync(path.dirname(skyDest), { recursive: true });
  
  await sharp(skySrc)
    .resize(1920, 1080, { fit: 'cover' })
    .png({ quality: 90 })
    .toFile(skyDest);
  console.log('✅ Sky background processed:', skyDest);
}

// Flood-fill or color distance background removal for pure white/light backgrounds
async function removeLightBackground(srcPath, destPath, options = {}) {
  const { threshold = 240, feather = 10, trim = true } = options;
  const image = sharp(srcPath);
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  
  const width = info.width;
  const height = info.height;
  const channels = info.channels; // 4

  // Alpha thresholding: if R, G, B are all close to white (> threshold), fade alpha to 0
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Check lightness / distance to pure white (255, 255, 255)
    const minVal = Math.min(r, g, b);
    if (minVal >= threshold - feather) {
      if (minVal >= threshold) {
        data[i + 3] = 0; // Completely transparent
      } else {
        const factor = (threshold - minVal) / feather;
        data[i + 3] = Math.round(data[i + 3] * factor);
      }
    }
  }

  let processed = sharp(data, {
    raw: {
      width,
      height,
      channels: 4,
    }
  });

  if (trim) {
    processed = processed.trim();
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await processed.png().toFile(destPath);
  console.log('✅ Processed transparent asset:', destPath);
}

async function main() {
  try {
    await processSky();

    const treeSrc = path.join(ARTIFACT_DIR, 'prop_avora_tree_1789290766237.jpg');
    const treeDest = path.join(PUBLIC_DIR, 'environment/props/avora_tree.png');
    await removeLightBackground(treeSrc, treeDest, { threshold: 245, feather: 15, trim: true });

    const islandSrc = path.join(ARTIFACT_DIR, 'env_island_cliff_1789290784310.jpg');
    const islandDest = path.join(PUBLIC_DIR, 'environment/terrain/island_cliff.png');
    await removeLightBackground(islandSrc, islandDest, { threshold: 242, feather: 12, trim: true });

    console.log('🎉 All 3 Hero Assets Successfully Processed & Extracted!');
  } catch (err) {
    console.error('Error processing hero assets:', err);
    process.exit(1);
  }
}

main();
