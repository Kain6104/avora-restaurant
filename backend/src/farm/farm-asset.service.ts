import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import sharp, { Metadata } from 'sharp';

export interface UpdateAssetConfigDto {
  renderScale?: number;
  renderOffsetX?: number;
  renderOffsetY?: number;
  anchorX?: number;
  anchorY?: number;
  isActive?: boolean;
  mutationName?: string;
}

export interface ApplyDefaultScaleDto {
  cropCode?: string;
  stageIndex?: number;
  mutationCode?: string;
  renderScale: number;
  renderOffsetX?: number;
  renderOffsetY?: number;
  scope: 'SELECTED_CROP_ALL_STAGES' | 'SPECIFIC_STAGE' | 'MUTATIONS' | 'ALL_CROPS';
}

export interface UploadAssetDto {
  cropCode: string;
  assetType: 'STAGE' | 'MUTATION';
  stageIndex?: number;
  mutationCode?: string;
  mutationName?: string;
}

export const CROP_FOLDER_MAP: Record<string, string> = {
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

@Injectable()
export class FarmAssetService {
  private readonly farmPublicDir = path.resolve(process.cwd(), '../frontend/public/game/farm');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách toàn bộ asset phân nhóm theo cây trồng
   */
  async getGroupedAssets() {
    const assets = await this.prisma.farmPlantAsset.findMany({
      orderBy: [{ cropCode: 'asc' }, { assetType: 'asc' }, { stageIndex: 'asc' }],
    });

    const cropsMap = new Map<string, {
      cropCode: string;
      cropName: string;
      stages: any[];
      mutations: any[];
      updatedAt: Date;
    }>();

    for (const a of assets) {
      if (!cropsMap.has(a.cropCode)) {
        cropsMap.set(a.cropCode, {
          cropCode: a.cropCode,
          cropName: a.cropName || a.cropCode,
          stages: [],
          mutations: [],
          updatedAt: a.updatedAt,
        });
      }

      const item = cropsMap.get(a.cropCode)!;
      if (a.updatedAt > item.updatedAt) {
        item.updatedAt = a.updatedAt;
      }

      if (a.assetType === 'STAGE') {
        item.stages.push(a);
      } else {
        item.mutations.push(a);
      }
    }

    // Đảm bảo sort stages 0..5
    cropsMap.forEach((c) => {
      c.stages.sort((x, y) => (x.stageIndex ?? 0) - (y.stageIndex ?? 0));
    });

    // Lấy thứ tự chuẩn từ bảng FarmCrop nếu có
    const allCrops = await this.prisma.farmCrop.findMany({
      select: { code: true, name: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });

    const cropOrderMap = new Map(allCrops.map((c, idx) => [c.code, c.sortOrder ?? idx]));

    const result = Array.from(cropsMap.values());
    result.sort((a, b) => {
      const orderA = cropOrderMap.has(a.cropCode) ? cropOrderMap.get(a.cropCode)! : 999;
      const orderB = cropOrderMap.has(b.cropCode) ? cropOrderMap.get(b.cropCode)! : 999;
      return orderA - orderB;
    });

    return result;
  }

  /**
   * Lấy danh sách phẳng phục vụ sync cấu hình
   */
  async getAllAssets() {
    return this.prisma.farmPlantAsset.findMany({
      where: { isActive: true },
    });
  }

  /**
   * Cập nhật thông số scale, offset, anchor của asset
   */
  async updateAssetConfig(id: string, dto: UpdateAssetConfigDto, userId?: string) {
    const existing = await this.prisma.farmPlantAsset.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy asset cây trồng');
    }

    const updated = await this.prisma.farmPlantAsset.update({
      where: { id },
      data: {
        renderScale: dto.renderScale !== undefined ? Number(dto.renderScale) : existing.renderScale,
        renderOffsetX: dto.renderOffsetX !== undefined ? Number(dto.renderOffsetX) : existing.renderOffsetX,
        renderOffsetY: dto.renderOffsetY !== undefined ? Number(dto.renderOffsetY) : existing.renderOffsetY,
        anchorX: dto.anchorX !== undefined ? Number(dto.anchorX) : existing.anchorX,
        anchorY: dto.anchorY !== undefined ? Number(dto.anchorY) : existing.anchorY,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
        mutationName: dto.mutationName !== undefined ? dto.mutationName : existing.mutationName,
        version: existing.version + 1, // Tăng version phục vụ cache busting
      },
    });

    await this.logAudit(
      userId,
      'FARM_ASSET_UPDATE_CONFIG',
      `PlantAsset:${id}:${existing.cropCode}:${existing.assetType}`,
      JSON.stringify({ scale: existing.renderScale, offsetX: existing.renderOffsetX, offsetY: existing.renderOffsetY, isActive: existing.isActive }),
      JSON.stringify({ scale: updated.renderScale, offsetX: updated.renderOffsetX, offsetY: updated.renderOffsetY, isActive: updated.isActive }),
    );

    return updated;
  }

  /**
   * Áp dụng kích thước mặc định hàng loạt cho FarmPlantAsset theo phạm vi được chọn
   */
  async applyDefaultScale(dto: ApplyDefaultScaleDto, userId?: string) {
    const where: any = { isActive: true };
    if (dto.scope === 'SELECTED_CROP_ALL_STAGES' && dto.cropCode) {
      where.cropCode = dto.cropCode;
    } else if (dto.scope === 'SPECIFIC_STAGE' && dto.cropCode && dto.stageIndex !== undefined) {
      where.cropCode = dto.cropCode;
      where.stageIndex = Number(dto.stageIndex);
      where.assetType = 'STAGE';
    } else if (dto.scope === 'MUTATIONS' && dto.cropCode) {
      where.cropCode = dto.cropCode;
      where.assetType = 'MUTATION';
      if (dto.mutationCode) {
        where.mutationCode = dto.mutationCode;
      }
    }

    const targets = await this.prisma.farmPlantAsset.findMany({ where });
    if (targets.length === 0) {
      throw new NotFoundException('Không tìm thấy assets phù hợp với phạm vi đã chọn');
    }

    const updateData: any = {
      renderScale: Number(dto.renderScale),
      version: { increment: 1 },
    };
    if (dto.renderOffsetX !== undefined) updateData.renderOffsetX = Number(dto.renderOffsetX);
    if (dto.renderOffsetY !== undefined) updateData.renderOffsetY = Number(dto.renderOffsetY);

    const result = await this.prisma.farmPlantAsset.updateMany({
      where,
      data: updateData,
    });

    await this.logAudit(
      userId,
      'FARM_ASSET_APPLY_DEFAULT_SCALE',
      `Scope:${dto.scope}:${dto.cropCode || 'ALL'}:${dto.stageIndex ?? 'ALL'}`,
      JSON.stringify({ targetsCount: targets.length, previousScales: targets.map((t) => ({ id: t.id, scale: t.renderScale })) }),
      JSON.stringify({ updatedCount: result.count, newScale: dto.renderScale }),
    );

    return { updatedCount: result.count };
  }

  /**
   * Xử lý file Upload từ Admin (PNG, WebP hoặc AVIF)
   * Tự động sinh AVIF + WebP, verify, lưu vào frontend/public và cập nhật DB
   */
  async handleAssetUpload(file: Express.Multer.File, dto: UploadAssetDto, userId?: string) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Không nhận được dữ liệu file hình ảnh');
    }

    const { cropCode, assetType, stageIndex, mutationCode, mutationName } = dto;
    if (!cropCode || !assetType) {
      throw new BadRequestException('Thiếu thông tin cropCode hoặc assetType');
    }

    const numStage = stageIndex !== undefined ? Number(stageIndex) : 0;
    const cleanCrop = cropCode.toUpperCase().trim();
    const cleanMut = (mutationCode || '').toUpperCase().trim();

    // 1. Xác định thư mục lưu trữ thực tế
    let targetFolder = 'crops/rice';
    const folderKey = CROP_FOLDER_MAP[cleanCrop];
    if (folderKey) {
      targetFolder = `crops/${folderKey}`;
    } else {
      const folderCode = cleanCrop.toLowerCase();
      if (folderCode.includes('rice')) targetFolder = 'crops/rice';
      else if (folderCode.includes('straw')) targetFolder = 'crops/strawberry';
      else if (folderCode.includes('grape')) targetFolder = 'crops/grape';
      else if (folderCode.includes('matcha')) targetFolder = 'crops/matcha';
      else if (folderCode.includes('sakura')) targetFolder = 'crops/sakura';
      else if (folderCode.includes('yuzu')) targetFolder = 'crops/yuzu';
      else if (folderCode.includes('corn') || folderCode.includes('bap') || folderCode.includes('ngo')) targetFolder = 'crops/corn';
      else if (folderCode.includes('tomato') || folderCode.includes('ca_chua')) targetFolder = 'crops/tomato';
      else if (folderCode.includes('sunflower') || folderCode.includes('huong_duong')) targetFolder = 'crops/sunflower';
      else if (folderCode.includes('wasabi')) targetFolder = 'crops/wasabi';
      else if (folderCode.includes('shiso') || folderCode.includes('perilla') || folderCode.includes('tia_to')) targetFolder = 'crops/perilla';
      else if (folderCode.includes('salmon') || folderCode.includes('hoa_hoi')) targetFolder = 'crops/salmon-anise';
      else if (folderCode.includes('coral') || folderCode.includes('san_ho')) targetFolder = 'crops/ocean-coral';
      else if (folderCode.includes('peach') || folderCode.includes('dao')) targetFolder = 'crops/peach';
      else targetFolder = `crops/${folderCode}`;
    }

    if (assetType === 'MUTATION') {
      const folderBase = folderKey || cleanCrop.toLowerCase();
      const mutFolder = cleanMut ? cleanMut.toLowerCase().replace(/_/g, '-') : 'default';
      const specificMutDir = path.join(this.farmPublicDir, 'mutations', mutFolder);
      const cropMutDir = path.join(this.farmPublicDir, 'mutations', folderBase);

      if (fs.existsSync(specificMutDir)) {
        targetFolder = `mutations/${mutFolder}`;
      } else {
        targetFolder = `mutations/${folderBase}`;
      }
    }

    const destDir = path.join(this.farmPublicDir, targetFolder);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // 2. Tạo tên file chuẩn (Predictable Naming)
    let fileBaseName = '';
    if (assetType === 'STAGE') {
      fileBaseName = `stage_${numStage}`;
    } else {
      if (cleanMut.includes('MOONLIGHT_RICE') || cleanMut.includes('NGUYET_QUANG')) {
        fileBaseName = 'lua_nguyet_quang';
      } else if (cleanMut.includes('GOLDEN_RICE') || cleanMut.includes('VANG_24K')) {
        fileBaseName = 'lua_vang_24k';
      } else {
        fileBaseName = cleanMut.toLowerCase();
      }
    }

    // 3. Đọc metadata và decode hình ảnh bằng Sharp
    let metadata: Metadata;
    try {
      metadata = await sharp(file.buffer).metadata();
    } catch (e) {
      throw new BadRequestException('File không phải là hình ảnh hợp lệ hoặc bị hỏng');
    }

    const width = metadata.width || 128;
    const height = metadata.height || 136;
    const hasAlpha = metadata.hasAlpha || false;

    // 4. Đường dẫn các file đầu ra
    const avifFileName = `${fileBaseName}.avif`;
    const webpFileName = `${fileBaseName}.webp`;
    const pngFileName = `${fileBaseName}.png`;

    const avifFullPath = path.join(destDir, avifFileName);
    const webpFullPath = path.join(destDir, webpFileName);
    const pngFullPath = path.join(destDir, pngFileName);

    // Lưu file tạm trước (Atomic write)
    const tempPrefix = `temp_${Date.now()}_`;
    const tempAvif = path.join(destDir, `${tempPrefix}${avifFileName}`);
    const tempWebp = path.join(destDir, `${tempPrefix}${webpFileName}`);
    const tempPng = path.join(destDir, `${tempPrefix}${pngFileName}`);

    try {
      // Chuyển đổi sang WebP
      await sharp(file.buffer)
        .webp({ quality: 88, alphaQuality: 100, smartSubsample: true, effort: 5 })
        .toFile(tempWebp);

      // Chuyển đổi sang AVIF
      await sharp(file.buffer)
        .avif({ quality: 70, effort: 5, chromaSubsampling: '4:4:4' })
        .toFile(tempAvif);

      // Lưu file PNG gốc làm fallback
      await sharp(file.buffer)
        .png({ compressionLevel: 6 })
        .toFile(tempPng);

      // Verification kiểm tra chất lượng file đầu ra
      const avifMeta = await sharp(tempAvif).metadata();
      const webpMeta = await sharp(tempWebp).metadata();

      if (!avifMeta.width || !webpMeta.width) {
        throw new Error('Không thể decode file sau khi nén');
      }

      // Đổi tên file tạm sang file chính thức (Atomic swap)
      if (fs.existsSync(tempAvif)) fs.renameSync(tempAvif, avifFullPath);
      if (fs.existsSync(tempWebp)) fs.renameSync(tempWebp, webpFullPath);
      if (fs.existsSync(tempPng)) fs.renameSync(tempPng, pngFullPath);
    } catch (err: any) {
      // Cleanup file tạm nếu có lỗi
      if (fs.existsSync(tempAvif)) fs.unlinkSync(tempAvif);
      if (fs.existsSync(tempWebp)) fs.unlinkSync(tempWebp);
      if (fs.existsSync(tempPng)) fs.unlinkSync(tempPng);
      throw new BadRequestException(`Lỗi khi tối ưu hóa hình ảnh: ${err.message}`);
    }

    // 5. Cập nhật kích thước file
    const avifSize = fs.statSync(avifFullPath).size;
    const webpSize = fs.statSync(webpFullPath).size;
    const pngSize = fs.statSync(pngFullPath).size;

    const relAvifUrl = `/game/farm/${targetFolder}/${avifFileName}`;
    const relWebpUrl = `/game/farm/${targetFolder}/${webpFileName}`;
    const relPngUrl = `/game/farm/${targetFolder}/${pngFileName}`;

    // 6. Cập nhật cơ sở dữ liệu và tăng version (Cache Busting)
    const existing = await this.prisma.farmPlantAsset.findFirst({
      where: {
        cropCode: cleanCrop,
        assetType,
        stageIndex: assetType === 'STAGE' ? numStage : 0,
        mutationCode: assetType === 'MUTATION' ? cleanMut : '',
      },
    });

    const newVersion = (existing?.version ?? 0) + 1;

    const savedRecord = await this.prisma.farmPlantAsset.upsert({
      where: {
        cropCode_assetType_stageIndex_mutationCode: {
          cropCode: cleanCrop,
          assetType,
          stageIndex: assetType === 'STAGE' ? numStage : 0,
          mutationCode: assetType === 'MUTATION' ? cleanMut : '',
        },
      },
      update: {
        avifUrl: relAvifUrl,
        webpUrl: relWebpUrl,
        fallbackUrl: relPngUrl,
        originalUrl: relPngUrl,
        width,
        height,
        hasAlpha,
        originalFileSize: pngSize,
        avifFileSize: avifSize,
        webpFileSize: webpSize,
        version: newVersion,
        mutationName: mutationName || existing?.mutationName,
      },
      create: {
        cropCode: cleanCrop,
        cropName: cleanCrop,
        assetType,
        stageIndex: assetType === 'STAGE' ? numStage : 0,
        mutationCode: assetType === 'MUTATION' ? cleanMut : '',
        mutationName: mutationName || (assetType === 'MUTATION' ? cleanMut : undefined),
        avifUrl: relAvifUrl,
        webpUrl: relWebpUrl,
        fallbackUrl: relPngUrl,
        originalUrl: relPngUrl,
        width,
        height,
        hasAlpha,
        originalFileSize: pngSize,
        avifFileSize: avifSize,
        webpFileSize: webpSize,
        renderScale: 1.0,
        renderOffsetX: 0,
        renderOffsetY: 0,
        anchorX: 0.5,
        anchorY: targetFolder.includes('rice') && numStage === 0 ? 0.7656 : 0.98,
        version: newVersion,
        isActive: true,
      },
    });

    await this.logAudit(
      userId,
      'FARM_ASSET_UPLOAD_REPLACE',
      `PlantAsset:${savedRecord.id}:${cleanCrop}:${assetType}`,
      existing ? JSON.stringify({ avif: existing.avifUrl, version: existing.version }) : null,
      JSON.stringify({ avif: savedRecord.avifUrl, version: savedRecord.version, avifSize: savedRecord.avifFileSize }),
    );

    return savedRecord;
  }

  private async logAudit(
    userId: string | undefined,
    action: string,
    target: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    try {
      if (!userId) return;
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          target,
          oldValue,
          newValue,
        },
      });
    } catch {
      // Non-blocking audit logging
    }
  }
}
