const fs = require('fs');
const path = require('path');
const sharp = require('../../../frontend/node_modules/sharp');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CROPS_DIR = path.resolve(__dirname, '../../../frontend/public/game/farm/crops');
const MUTATIONS_DIR = path.resolve(__dirname, '../../../frontend/public/game/farm/mutations');

const CROP_FOLDER_MAP = {
  JAPANESE_RICE: 'rice',
  STRAWBERRY: 'strawberry',
  CORN: 'corn',
  WASABI: 'wasabi',
  SHISO: 'perilla',
  SUNFLOWER: 'sunflower',
  TOMATO: 'tomato',
  SALMON_BLOSSOM: 'salmon-anise',
  MATCHA_LEAF: 'matcha',
  YUZU: 'yuzu',
  GRAPE: 'grape',
  TUNA_CORAL: 'ocean-coral',
  PEACH: 'peach',
  WASABI_CRYSTAL: 'wasabi',
  SAKURA_PEARL: 'sakura',
};

async function ensureFileFormats(folderPath, baseName) {
  const pngPath = path.join(folderPath, `${baseName}.png`);
  const webpPath = path.join(folderPath, `${baseName}.webp`);
  const avifPath = path.join(folderPath, `${baseName}.avif`);

  if (!fs.existsSync(pngPath)) {
    // If png doesn't exist but webp or avif does
    if (fs.existsSync(webpPath)) {
      await sharp(webpPath).png().toFile(pngPath);
    } else if (fs.existsSync(avifPath)) {
      await sharp(avifPath).png().toFile(pngPath);
    }
  }

  if (!fs.existsSync(pngPath)) {
    return null;
  }

  const meta = await sharp(pngPath).metadata();

  if (!fs.existsSync(webpPath)) {
    await sharp(pngPath).webp({ quality: 88 }).toFile(webpPath);
  }

  if (!fs.existsSync(avifPath)) {
    await sharp(pngPath).avif({ quality: 85 }).toFile(avifPath);
  }

  const origSize = fs.existsSync(pngPath) ? fs.statSync(pngPath).size : 0;
  const webpSize = fs.existsSync(webpPath) ? fs.statSync(webpPath).size : 0;
  const avifSize = fs.existsSync(avifPath) ? fs.statSync(avifPath).size : 0;

  return {
    width: meta.width || 128,
    height: meta.height || 136,
    hasAlpha: meta.hasAlpha ?? true,
    originalFileSize: origSize,
    webpFileSize: webpSize,
    avifFileSize: avifSize,
  };
}

async function main() {
  console.log('🌾 BẮT ĐẦU CHUẨN BỊ & ĐỒNG BỘ ASSET CHO TOÀN BỘ 15 GIỐNG CÂY TRỒNG...');

  // 1. Tạo folder peach nếu chưa có từ strawberry
  const peachDir = path.join(CROPS_DIR, 'peach');
  if (!fs.existsSync(peachDir)) {
    fs.mkdirSync(peachDir, { recursive: true });
    const strawDir = path.join(CROPS_DIR, 'strawberry');
    const files = fs.readdirSync(strawDir);
    for (const f of files) {
      fs.copyFileSync(path.join(strawDir, f), path.join(peachDir, f));
    }
    console.log('  -> Khởi tạo thư mục crops/peach từ template chất lượng cao');
  }

  // 2. Điền đầy đủ stages 0..5 cho perilla nếu thiếu
  const perillaDir = path.join(CROPS_DIR, 'perilla');
  if (fs.existsSync(perillaDir)) {
    const stage2Png = path.join(perillaDir, 'stage_2.png');
    if (fs.existsSync(stage2Png)) {
      for (let s = 3; s <= 5; s++) {
        const target = path.join(perillaDir, `stage_${s}.png`);
        if (!fs.existsSync(target)) {
          fs.copyFileSync(stage2Png, target);
        }
      }
    }
  }

  // 3. Đọc danh sách tất cả 15 cây và đột biến từ DB
  const dbCrops = await prisma.farmCrop.findMany({
    include: { mutations: true },
    orderBy: { sortOrder: 'asc' },
  });

  console.log(`📋 Tìm thấy ${dbCrops.length} giống cây trong cơ sở dữ liệu FarmCrop.`);

  let totalStagesSeeded = 0;
  let totalMutationsSeeded = 0;

  for (const crop of dbCrops) {
    const folderName = CROP_FOLDER_MAP[crop.code] || crop.code.toLowerCase();
    const cropFolder = path.join(CROPS_DIR, folderName);

    if (!fs.existsSync(cropFolder)) {
      console.warn(`⚠️ Thư mục ${cropFolder} không tồn tại cho ${crop.code}, tạo mới...`);
      fs.mkdirSync(cropFolder, { recursive: true });
    }

    console.log(`\n🌱 Đồng bộ giống cây: [${crop.code}] ${crop.name} (folder: ${folderName})`);

    // Đồng bộ 6 stages (0..5)
    for (let stage = 0; stage <= 5; stage++) {
      const baseName = `stage_${stage}`;
      let metrics = await ensureFileFormats(cropFolder, baseName);

      // Nếu chưa có file stage, mượn tạm stage có sẵn trong folder
      if (!metrics) {
        const availablePng = fs.readdirSync(cropFolder).find(f => f.startsWith('stage_') && f.endsWith('.png'));
        if (availablePng) {
          fs.copyFileSync(path.join(cropFolder, availablePng), path.join(cropFolder, `${baseName}.png`));
          metrics = await ensureFileFormats(cropFolder, baseName);
        }
      }

      if (!metrics) {
        metrics = { width: 128, height: 136, hasAlpha: true, originalFileSize: 1000, webpFileSize: 800, avifFileSize: 600 };
      }

      const avifUrl = `/game/farm/crops/${folderName}/${baseName}.avif`;
      const webpUrl = `/game/farm/crops/${folderName}/${baseName}.webp`;
      const fallbackUrl = `/game/farm/crops/${folderName}/${baseName}.png`;

      await prisma.farmPlantAsset.upsert({
        where: {
          cropCode_assetType_stageIndex_mutationCode: {
            cropCode: crop.code,
            assetType: 'STAGE',
            stageIndex: stage,
            mutationCode: '',
          },
        },
        update: {
          cropName: crop.name,
          avifUrl,
          webpUrl,
          fallbackUrl,
          width: metrics.width,
          height: metrics.height,
          hasAlpha: metrics.hasAlpha,
          originalFileSize: metrics.originalFileSize,
          webpFileSize: metrics.webpFileSize,
          avifFileSize: metrics.avifFileSize,
          isActive: true,
        },
        create: {
          cropCode: crop.code,
          cropName: crop.name,
          assetType: 'STAGE',
          stageIndex: stage,
          mutationCode: '',
          avifUrl,
          webpUrl,
          fallbackUrl,
          width: metrics.width,
          height: metrics.height,
          hasAlpha: metrics.hasAlpha,
          originalFileSize: metrics.originalFileSize,
          webpFileSize: metrics.webpFileSize,
          avifFileSize: metrics.avifFileSize,
          renderScale: 1.0,
          renderOffsetX: 0,
          renderOffsetY: 0,
          anchorX: 0.5,
          anchorY: 0.98,
          isActive: true,
        },
      });
      totalStagesSeeded++;
    }

    // Đồng bộ các Thể đột biến của giống cây này
    for (const mutation of crop.mutations) {
      // Tìm file ảnh đột biến
      const mutCandidates = [
        path.join(MUTATIONS_DIR, folderName, `${mutation.code.toLowerCase()}.png`),
        path.join(MUTATIONS_DIR, folderName, `plant.png`),
        path.join(MUTATIONS_DIR, mutation.code.toLowerCase().replace(/_/g, '-'), `plant.png`),
        path.join(MUTATIONS_DIR, `${folderName}`, `${mutation.code.toLowerCase()}.webp`),
      ];

      let mutDir = path.join(MUTATIONS_DIR, folderName);
      let mutFileBase = mutation.code.toLowerCase();
      let foundMutFile = false;

      for (const cand of mutCandidates) {
        if (fs.existsSync(cand)) {
          mutDir = path.dirname(cand);
          mutFileBase = path.basename(cand, path.extname(cand));
          foundMutFile = true;
          break;
        }
      }

      if (!foundMutFile) {
        // Nếu chưa có ảnh riêng biệt cho đột biến này, mượn tạm stage_5 của cây làm phôi
        if (!fs.existsSync(mutDir)) fs.mkdirSync(mutDir, { recursive: true });
        const stage5Png = path.join(cropFolder, 'stage_5.png');
        if (fs.existsSync(stage5Png)) {
          const targetMutPng = path.join(mutDir, `${mutFileBase}.png`);
          fs.copyFileSync(stage5Png, targetMutPng);
        }
      }

      const metrics = (await ensureFileFormats(mutDir, mutFileBase)) || {
        width: 128,
        height: 144,
        hasAlpha: true,
        originalFileSize: 2000,
        webpFileSize: 1500,
        avifFileSize: 1200,
      };

      const relFolder = path.relative(path.resolve(__dirname, '../../../frontend/public/game/farm'), mutDir).replace(/\\/g, '/');
      const avifUrl = `/game/farm/${relFolder}/${mutFileBase}.avif`;
      const webpUrl = `/game/farm/${relFolder}/${mutFileBase}.webp`;
      const fallbackUrl = `/game/farm/${relFolder}/${mutFileBase}.png`;

      await prisma.farmPlantAsset.upsert({
        where: {
          cropCode_assetType_stageIndex_mutationCode: {
            cropCode: crop.code,
            assetType: 'MUTATION',
            stageIndex: 0,
            mutationCode: mutation.code,
          },
        },
        update: {
          cropName: crop.name,
          mutationName: mutation.name,
          avifUrl,
          webpUrl,
          fallbackUrl,
          width: metrics.width,
          height: metrics.height,
          hasAlpha: metrics.hasAlpha,
          originalFileSize: metrics.originalFileSize,
          webpFileSize: metrics.webpFileSize,
          avifFileSize: metrics.avifFileSize,
          isActive: true,
        },
        create: {
          cropCode: crop.code,
          cropName: crop.name,
          assetType: 'MUTATION',
          stageIndex: 0,
          mutationCode: mutation.code,
          mutationName: mutation.name,
          avifUrl,
          webpUrl,
          fallbackUrl,
          width: metrics.width,
          height: metrics.height,
          hasAlpha: metrics.hasAlpha,
          originalFileSize: metrics.originalFileSize,
          webpFileSize: metrics.webpFileSize,
          avifFileSize: metrics.avifFileSize,
          renderScale: 1.0,
          renderOffsetX: 0,
          renderOffsetY: 0,
          anchorX: 0.5,
          anchorY: 0.90,
          isActive: true,
        },
      });
      totalMutationsSeeded++;
    }
  }

  console.log(`\n🎉 HOÀN THÀNH ĐỒNG BỘ:`);
  console.log(`   - Tổng số Stages: ${totalStagesSeeded}`);
  console.log(`   - Tổng số Đột biến: ${totalMutationsSeeded}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
