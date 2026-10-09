import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding FarmPlantAsset records...');

  const manifestPath = path.resolve(__dirname, '../../../frontend/public/game/farm/farm-image-migration.json');
  let manifest: Record<string, any> = {};
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      console.warn('Could not read manifest, using defaults');
    }
  }

  const crops = [
    { code: 'JAPANESE_RICE', name: 'Gạo Koshihikari', folder: 'rice' },
    { code: 'STRAWBERRY', name: 'Dâu Tây Tochigi', folder: 'strawberry' },
    { code: 'GRAPE', name: 'Nho Shine Muscat', folder: 'grape' },
    { code: 'MATCHA_LEAF', name: 'Lá Trà Uji Matcha', folder: 'matcha' },
    { code: 'SAKURA_PEARL', name: 'Ngọc Trai Anh Đào', folder: 'sakura' },
    { code: 'YUZU', name: 'Quả Yuzu Hoàng Kim', folder: 'yuzu' },
  ];

  let totalSeeded = 0;

  // 1. Seed 6 Stages for each crop
  for (const crop of crops) {
    for (let stage = 0; stage <= 5; stage++) {
      const sourcePng = `/game/farm/crops/${crop.folder}/stage_${stage}.png`;
      const meta = manifest[sourcePng] || {};

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
          avifUrl: meta.avif || `/game/farm/crops/${crop.folder}/stage_${stage}.avif`,
          webpUrl: meta.webp || `/game/farm/crops/${crop.folder}/stage_${stage}.webp`,
          fallbackUrl: sourcePng,
          width: meta.width || 128,
          height: meta.height || 136,
          originalFileSize: meta.originalBytes || 0,
          avifFileSize: meta.avifBytes || 0,
          webpFileSize: meta.webpBytes || 0,
          hasAlpha: meta.hasAlpha ?? true,
        },
        create: {
          cropCode: crop.code,
          cropName: crop.name,
          assetType: 'STAGE',
          stageIndex: stage,
          mutationCode: '',
          avifUrl: meta.avif || `/game/farm/crops/${crop.folder}/stage_${stage}.avif`,
          webpUrl: meta.webp || `/game/farm/crops/${crop.folder}/stage_${stage}.webp`,
          fallbackUrl: sourcePng,
          width: meta.width || 128,
          height: meta.height || 136,
          originalFileSize: meta.originalBytes || 0,
          avifFileSize: meta.avifBytes || 0,
          webpFileSize: meta.webpBytes || 0,
          hasAlpha: meta.hasAlpha ?? true,
          renderScale: 1.0,
          renderOffsetX: 0,
          renderOffsetY: 0,
          anchorX: 0.5,
          anchorY: crop.folder === 'rice' && stage === 0 ? 0.7656 : 0.98,
        },
      });
      totalSeeded++;
    }
  }

  // 2. Seed Mutations
  const mutations = [
    {
      cropCode: 'JAPANESE_RICE',
      cropName: 'Gạo Koshihikari',
      mutationCode: 'MOONLIGHT_RICE',
      mutationName: 'Lúa Nguyệt Quang',
      sourcePng: '/game/farm/mutations/rice/lua_nguyet_quang.png',
      avif: '/game/farm/mutations/rice/lua_nguyet_quang.avif',
      webp: '/game/farm/mutations/rice/lua_nguyet_quang.webp',
      anchorY: 0.9872,
    },
    {
      cropCode: 'JAPANESE_RICE',
      cropName: 'Gạo Koshihikari',
      mutationCode: 'GOLDEN_RICE',
      mutationName: 'Lúa Vàng 24K',
      sourcePng: '/game/farm/mutations/rice/lua_vang_24k.png',
      avif: '/game/farm/mutations/rice/lua_vang_24k.avif',
      webp: '/game/farm/mutations/rice/lua_vang_24k.webp',
      anchorY: 0.9952,
    },
    {
      cropCode: 'GRAPE',
      cropName: 'Nho Shine Muscat',
      mutationCode: 'GOLDEN_GRAPE',
      mutationName: 'Nho Vàng Hoàng Gia',
      sourcePng: '/game/farm/mutations/golden-grape/plant.png',
      avif: '/game/farm/mutations/golden-grape/plant.avif',
      webp: '/game/farm/mutations/golden-grape/plant.webp',
      anchorY: 0.88,
    },
    {
      cropCode: 'STRAWBERRY',
      cropName: 'Dâu Tây Tochigi',
      mutationCode: 'CRYSTAL_STRAWBERRY',
      mutationName: 'Dâu Tây Pha Lê',
      sourcePng: '/game/farm/mutations/crystal-strawberry/plant.png',
      avif: '/game/farm/mutations/crystal-strawberry/plant.avif',
      webp: '/game/farm/mutations/crystal-strawberry/plant.webp',
      anchorY: 0.82,
    },
    {
      cropCode: 'SAKURA_PEARL',
      cropName: 'Ngọc Trai Anh Đào',
      mutationCode: 'MOONLIGHT_SAKURA',
      mutationName: 'Ngọc Trai Nguyệt Hoa',
      sourcePng: '/game/farm/mutations/moonlight-sakura/plant.png',
      avif: '/game/farm/mutations/moonlight-sakura/plant.avif',
      webp: '/game/farm/mutations/moonlight-sakura/plant.webp',
      anchorY: 0.92,
    },
  ];

  for (const mut of mutations) {
    const meta = manifest[mut.sourcePng] || {};
    await prisma.farmPlantAsset.upsert({
      where: {
        cropCode_assetType_stageIndex_mutationCode: {
          cropCode: mut.cropCode,
          assetType: 'MUTATION',
          stageIndex: 0,
          mutationCode: mut.mutationCode,
        },
      },
      update: {
        cropName: mut.cropName,
        mutationName: mut.mutationName,
        avifUrl: mut.avif,
        webpUrl: mut.webp,
        fallbackUrl: mut.sourcePng,
        width: meta.width || 1254,
        height: meta.height || 1254,
        originalFileSize: meta.originalBytes || 0,
        avifFileSize: meta.avifBytes || 0,
        webpFileSize: meta.webpBytes || 0,
      },
      create: {
        cropCode: mut.cropCode,
        cropName: mut.cropName,
        assetType: 'MUTATION',
        stageIndex: 0,
        mutationCode: mut.mutationCode,
        mutationName: mut.mutationName,
        avifUrl: mut.avif,
        webpUrl: mut.webp,
        fallbackUrl: mut.sourcePng,
        width: meta.width || 1254,
        height: meta.height || 1254,
        originalFileSize: meta.originalBytes || 0,
        avifFileSize: meta.avifBytes || 0,
        webpFileSize: meta.webpBytes || 0,
        renderScale: 1.0,
        renderOffsetX: 0,
        renderOffsetY: 0,
        anchorX: 0.5,
        anchorY: mut.anchorY,
      },
    });
    totalSeeded++;
  }

  console.log(`✅ Successfully seeded ${totalSeeded} FarmPlantAsset records.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
