const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Cấu hình đường dẫn mục tiêu chỉ trong phạm vi thư mục Farm
const FARM_DIR = path.resolve(__dirname, '../public/game/farm');
const MANIFEST_PATH = path.resolve(FARM_DIR, 'farm-image-migration.json');

// Cấu hình mã hóa AVIF & WebP chuẩn Production cho Game Sprite Isometric
const AVIF_OPTIONS = {
  quality: 70, // Đảm bảo giữ nét chi tiết hào quang, độ mịn và hạt sáng
  effort: 5,   // Cân bằng tối ưu nén CPU
  chromaSubsampling: '4:4:4', // Giữ 100% độ trung thực màu sắc, không bệt màu viền
};

const WEBP_OPTIONS = {
  quality: 88,
  alphaQuality: 100, // Bảo toàn 100% alpha transparency
  smartSubsample: true,
  effort: 5,
};

// Hàm định dạng kích thước hiển thị thân thiện (KB / MB)
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Hàm quét đệ quy các file PNG, bỏ qua các thư mục hệ thống
function findPngFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Exclude các thư mục không liên quan
      if (['node_modules', '.next', 'dist', 'build', 'coverage', '.git', 'cache', 'temp'].includes(entry.name)) {
        continue;
      }
      findPngFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

async function optimizeImage(pngPath, manifestMap) {
  const relPath = path.relative(path.resolve(__dirname, '../public'), pngPath).replace(/\\/g, '/');
  const baseDir = path.dirname(pngPath);
  const baseName = path.basename(pngPath, path.extname(pngPath));

  const avifPath = path.join(baseDir, `${baseName}.avif`);
  const webpPath = path.join(baseDir, `${baseName}.webp`);

  const pngStats = fs.statSync(pngPath);
  const originalBytes = pngStats.size;

  // Kiểm tra Incremental Optimization (mtime)
  const avifExists = fs.existsSync(avifPath);
  const webpExists = fs.existsSync(webpPath);

  if (avifExists && webpExists) {
    const avifStats = fs.statSync(avifPath);
    const webpStats = fs.statSync(webpPath);

    if (pngStats.mtimeMs <= avifStats.mtimeMs && pngStats.mtimeMs <= webpStats.mtimeMs) {
      // Đã được convert trước đó và PNG không thay đổi
      return {
        status: 'SKIPPED',
        source: `/${relPath}`,
        originalBytes,
        avifBytes: avifStats.size,
        webpBytes: webpStats.size,
      };
    }
  }

  // Đọc metadata ảnh gốc
  const sourceImage = sharp(pngPath);
  const meta = await sourceImage.metadata();
  const width = meta.width;
  const height = meta.height;
  const hasAlpha = meta.hasAlpha || false;

  // 1. Chuyển đổi sang WebP Fallback
  await sharp(pngPath)
    .webp(WEBP_OPTIONS)
    .toFile(webpPath);

  // 2. Chuyển đổi sang AVIF Primary
  await sharp(pngPath)
    .avif(AVIF_OPTIONS)
    .toFile(avifPath);

  // 3. Verification kiểm tra chất lượng & kích thước
  const avifStats = fs.statSync(avifPath);
  const webpStats = fs.statSync(webpPath);

  if (avifStats.size === 0 || webpStats.size === 0) {
    throw new Error('Output file size is 0 bytes!');
  }

  const verifyAvifMeta = await sharp(avifPath).metadata();
  const verifyWebpMeta = await sharp(webpPath).metadata();

  if (verifyAvifMeta.width !== width || verifyAvifMeta.height !== height) {
    throw new Error(`AVIF dimensions mismatch! Expected ${width}x${height}, got ${verifyAvifMeta.width}x${verifyAvifMeta.height}`);
  }

  if (verifyWebpMeta.width !== width || verifyWebpMeta.height !== height) {
    throw new Error(`WebP dimensions mismatch! Expected ${width}x${height}, got ${verifyWebpMeta.width}x${verifyWebpMeta.height}`);
  }

  if (hasAlpha && (!verifyAvifMeta.hasAlpha || !verifyWebpMeta.hasAlpha)) {
    throw new Error('Alpha channel transparency was lost during conversion!');
  }

  const avifReduction = ((originalBytes - avifStats.size) / originalBytes) * 100;
  const webpReduction = ((originalBytes - webpStats.size) / originalBytes) * 100;

  console.log(`✅ ${path.basename(pngPath)}`);
  console.log(`   Original PNG: ${formatBytes(originalBytes)}`);
  console.log(`   WebP:         ${formatBytes(webpStats.size)} (-${webpReduction.toFixed(2)}%)`);
  console.log(`   AVIF:         ${formatBytes(avifStats.size)} (-${avifReduction.toFixed(2)}%)`);
  console.log(`   Dimensions:   ${width}x${height}px (Alpha: ${hasAlpha ? 'Preserved' : 'None'})`);

  const relAvif = path.relative(path.resolve(__dirname, '../public'), avifPath).replace(/\\/g, '/');
  const relWebp = path.relative(path.resolve(__dirname, '../public'), webpPath).replace(/\\/g, '/');

  const entry = {
    source: `/${relPath}`,
    avif: `/${relAvif}`,
    webp: `/${relWebp}`,
    originalBytes,
    avifBytes: avifStats.size,
    webpBytes: webpStats.size,
    width,
    height,
    hasAlpha,
    verified: true,
    timestamp: new Date().toISOString(),
  };

  manifestMap[entry.source] = entry;

  return {
    status: 'CONVERTED',
    ...entry,
  };
}

async function run() {
  console.log('========================================================');
  console.log('🚀 AVORA FARM IMAGE OPTIMIZATION PIPELINE (SHARP)');
  console.log(`📂 Scanning: ${FARM_DIR}`);
  console.log('========================================================\n');

  if (!fs.existsSync(FARM_DIR)) {
    console.error(`❌ Farm directory not found: ${FARM_DIR}`);
    process.exit(1);
  }

  const pngFiles = findPngFiles(FARM_DIR);
  console.log(`🔍 Found ${pngFiles.length} PNG assets in Farm directory.\n`);

  let manifestMap = {};
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      manifestMap = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch {
      manifestMap = {};
    }
  }

  let convertedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failedFiles = [];

  let totalOriginalBytes = 0;
  let totalWebpBytes = 0;
  let totalAvifBytes = 0;

  for (const file of pngFiles) {
    try {
      const res = await optimizeImage(file, manifestMap);
      totalOriginalBytes += res.originalBytes;
      totalWebpBytes += res.webpBytes;
      totalAvifBytes += res.avifBytes;

      if (res.status === 'CONVERTED') {
        convertedCount++;
      } else if (res.status === 'SKIPPED') {
        skippedCount++;
      }
    } catch (err) {
      failedCount++;
      failedFiles.push({ file: path.basename(file), error: err.message });
      console.error(`❌ Error converting ${path.basename(file)}:`, err.message);
    }
  }

  // Ghi file Manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestMap, null, 2), 'utf8');
  console.log(`\n📋 Migration manifest updated: ${MANIFEST_PATH}`);

  const totalSaved = totalOriginalBytes - totalAvifBytes;
  const overallReduction = totalOriginalBytes > 0 ? (totalSaved / totalOriginalBytes) * 100 : 0;

  console.log('\n==============================================');
  console.log('AVORA FARM ASSET OPTIMIZATION COMPLETED');
  console.log('==============================================');
  console.log(`PNG scanned:         ${pngFiles.length}`);
  console.log(`Converted:           ${convertedCount}`);
  console.log(`Skipped:             ${skippedCount}`);
  console.log(`Failed:              ${failedCount}`);
  console.log(`Original PNG size:   ${formatBytes(totalOriginalBytes)}`);
  console.log(`WebP size:           ${formatBytes(totalWebpBytes)}`);
  console.log(`AVIF size:           ${formatBytes(totalAvifBytes)}`);
  console.log(`AVIF saved:          ${formatBytes(totalSaved)}`);
  console.log(`Reduction:           ${overallReduction.toFixed(2)}%`);
  console.log('==============================================');

  if (failedCount > 0) {
    console.log('\nFAILED FILES:');
    failedFiles.forEach((f) => console.log(` - ${f.file}: ${f.error}`));
  } else {
    console.log('Failed: 0');
  }
}

run().catch((e) => {
  console.error('Fatal pipeline error:', e);
  process.exit(1);
});
