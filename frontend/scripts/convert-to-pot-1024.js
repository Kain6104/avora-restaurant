const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CROPS_DIR = path.resolve(__dirname, '../public/game/farm/crops');
const MUTATIONS_DIR = path.resolve(__dirname, '../public/game/farm/mutations');

async function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.png')) {
      const meta = await sharp(fullPath).metadata();
      if (meta.width === 1254 && meta.height === 1254) {
        console.log(`Resizing 1254x1254 -> 1024x1024: ${path.relative(__dirname, fullPath)}`);
        const baseDir = path.dirname(fullPath);
        const baseName = path.basename(fullPath, '.png');
        const webpPath = path.join(baseDir, `${baseName}.webp`);
        const avifPath = path.join(baseDir, `${baseName}.avif`);

        // Buffer resized 1024x1024 PNG
        const resizedBuf = await sharp(fullPath)
          .resize(1024, 1024, { kernel: sharp.kernel.lanczos3, fit: 'fill' })
          .png()
          .toBuffer();

        fs.writeFileSync(fullPath, resizedBuf);

        // Re-encode WebP with high quality
        await sharp(resizedBuf)
          .webp({ quality: 90, alphaQuality: 100, smartSubsample: true, effort: 5 })
          .toFile(webpPath);

        // Re-encode AVIF with high quality
        await sharp(resizedBuf)
          .avif({ quality: 78, effort: 5, chromaSubsampling: '4:4:4' })
          .toFile(avifPath);
      }
    }
  }
}

async function main() {
  console.log('Starting Power-of-Two 1024x1024 texture normalization for crops & mutations...');
  await processDirectory(CROPS_DIR);
  await processDirectory(MUTATIONS_DIR);
  console.log('✅ Finished POT 1024x1024 normalization.');
}

main().catch(console.error);
