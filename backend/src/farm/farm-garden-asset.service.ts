import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import sharp, { Metadata } from 'sharp';
import { UploadGardenAssetDto, UpdateGardenAssetDto } from './dto/farm-layout.dto';

@Injectable()
export class FarmGardenAssetService {
  private readonly gardenAssetsDir = path.resolve(
    process.cwd(),
    '../frontend/public/game/farm/garden-assets',
  );

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách toàn bộ asset trang trí kèm thống kê số lần sử dụng (usedCount)
   */
  async getAllAssets(category?: string) {
    const whereClause: any = {};
    if (category && category !== 'ALL') {
      whereClause.category = category;
    }

    const assets = await this.prisma.farmGardenAsset.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { objects: true },
        },
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    return assets.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      originalUrl: a.originalUrl,
      avifUrl: a.avifUrl,
      webpUrl: a.webpUrl,
      fallbackUrl: a.fallbackUrl,
      originalFormat: a.originalFormat,
      mimeType: a.mimeType,
      originalFileSize: a.originalFileSize,
      width: a.width,
      height: a.height,
      hasAlpha: a.hasAlpha,
      defaultAnchorX: a.defaultAnchorX,
      defaultAnchorY: a.defaultAnchorY,
      defaultScale: a.defaultScale,
      isActive: a.isActive,
      usedCount: a._count.objects,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  }

  /**
   * Lấy chi tiết 1 asset
   */
  async getAssetById(id: string) {
    const asset = await this.prisma.farmGardenAsset.findUnique({
      where: { id },
      include: {
        _count: {
          select: { objects: true },
        },
      },
    });
    if (!asset) {
      throw new NotFoundException('Không tìm thấy tài nguyên trang trí');
    }
    return {
      ...asset,
      usedCount: asset._count.objects,
    };
  }

  /**
   * Xử lý file Upload từ Admin (.png, .webp, .avif)
   * Tự động xác thực kênh alpha, đo kích thước, sinh WebP + AVIF và lưu vào DB
   */
  async handleAssetUpload(
    file: Express.Multer.File,
    dto: UploadGardenAssetDto,
    userId?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Không nhận được dữ liệu file hình ảnh');
    }

    const { code, name, category, defaultAnchorX, defaultAnchorY, defaultScale } = dto;
    if (!code || !name || !category) {
      throw new BadRequestException('Thiếu thông tin bắt buộc: code, name, category');
    }

    const cleanCode = code.toUpperCase().trim();

    // Kiểm tra code đã tồn tại chưa
    const existing = await this.prisma.farmGardenAsset.findUnique({
      where: { code: cleanCode },
    });
    if (existing) {
      throw new BadRequestException(`Mã asset "${cleanCode}" đã tồn tại trên hệ thống`);
    }

    // 1. Phân loại thư mục lưu trữ theo category
    const folderName = category.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const destDir = path.join(this.gardenAssetsDir, folderName);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // 2. Decode và lấy metadata ảnh bằng Sharp
    let metadata: Metadata;
    try {
      metadata = await sharp(file.buffer).metadata();
    } catch {
      throw new BadRequestException('File không phải là hình ảnh hợp lệ hoặc bị hỏng');
    }

    const width = metadata.width || 128;
    const height = metadata.height || 128;
    const hasAlpha = Boolean(metadata.hasAlpha);
    const originalFormat = metadata.format || 'png';
    const mimeType = file.mimetype || `image/${originalFormat}`;

    // 3. Tên file lưu trữ chuẩn
    const timestamp = Date.now();
    const safeBaseName = `${cleanCode.toLowerCase()}_${timestamp}`;
    const avifFileName = `${safeBaseName}.avif`;
    const webpFileName = `${safeBaseName}.webp`;
    const origFileName = `${safeBaseName}.${originalFormat}`;

    const avifFullPath = path.join(destDir, avifFileName);
    const webpFullPath = path.join(destDir, webpFileName);
    const origFullPath = path.join(destDir, origFileName);

    // 4. Ghi file gốc và sinh WebP + AVIF tối ưu
    fs.writeFileSync(origFullPath, file.buffer);

    try {
      await sharp(file.buffer)
        .webp({ quality: 90, alphaQuality: 100, lossless: hasAlpha })
        .toFile(webpFullPath);
    } catch (err) {
      console.error('[FarmGardenAsset] Error converting to WebP:', err);
      fs.copyFileSync(origFullPath, webpFullPath);
    }

    try {
      await sharp(file.buffer)
        .avif({ quality: 85, effort: 4 })
        .toFile(avifFullPath);
    } catch (err) {
      console.warn('[FarmGardenAsset] AVIF conversion fallback to WebP:', err);
      fs.copyFileSync(webpFullPath, avifFullPath);
    }

    const webpUrl = `/game/farm/garden-assets/${folderName}/${webpFileName}`;
    const avifUrl = `/game/farm/garden-assets/${folderName}/${avifFileName}`;
    const originalUrl = `/game/farm/garden-assets/${folderName}/${origFileName}`;
    const fallbackUrl = webpUrl;

    // 5. Lưu bản ghi vào cơ sở dữ liệu
    const newAsset = await this.prisma.farmGardenAsset.create({
      data: {
        code: cleanCode,
        name: name.trim(),
        category: category.toUpperCase().trim(),
        originalUrl,
        avifUrl,
        webpUrl,
        fallbackUrl,
        originalFormat,
        mimeType,
        originalFileSize: file.size || file.buffer.length,
        width,
        height,
        hasAlpha,
        defaultAnchorX: defaultAnchorX !== undefined ? Number(defaultAnchorX) : 0.5,
        defaultAnchorY: defaultAnchorY !== undefined ? Number(defaultAnchorY) : 1.0,
        defaultScale: defaultScale !== undefined ? Number(defaultScale) : 1.0,
        isActive: true,
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'FARM_GARDEN_ASSET_UPLOAD',
          target: `FarmGardenAsset:${newAsset.id}:${newAsset.code}`,
          newValue: JSON.stringify({
            code: newAsset.code,
            name: newAsset.name,
            category: newAsset.category,
            width,
            height,
            hasAlpha,
          }),
        },
      });
    }

    return {
      ...newAsset,
      usedCount: 0,
    };
  }

  /**
   * Cập nhật thông số metadata của asset
   */
  async updateAssetConfig(id: string, dto: UpdateGardenAssetDto, userId?: string) {
    const existing = await this.prisma.farmGardenAsset.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài nguyên trang trí');
    }

    const updated = await this.prisma.farmGardenAsset.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        category: dto.category !== undefined ? dto.category.toUpperCase().trim() : existing.category,
        defaultAnchorX: dto.defaultAnchorX !== undefined ? Number(dto.defaultAnchorX) : existing.defaultAnchorX,
        defaultAnchorY: dto.defaultAnchorY !== undefined ? Number(dto.defaultAnchorY) : existing.defaultAnchorY,
        defaultScale: dto.defaultScale !== undefined ? Number(dto.defaultScale) : existing.defaultScale,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'FARM_GARDEN_ASSET_UPDATE',
          target: `FarmGardenAsset:${id}:${existing.code}`,
          oldValue: JSON.stringify({
            name: existing.name,
            category: existing.category,
            defaultScale: existing.defaultScale,
            isActive: existing.isActive,
          }),
          newValue: JSON.stringify({
            name: updated.name,
            category: updated.category,
            defaultScale: updated.defaultScale,
            isActive: updated.isActive,
          }),
        },
      });
    }

    return updated;
  }

  /**
   * Xóa asset với quy tắc an toàn: Không cho xóa cứng nếu đang được sử dụng
   */
  async deleteAsset(id: string, userId?: string) {
    const existing = await this.prisma.farmGardenAsset.findUnique({
      where: { id },
      include: {
        _count: {
          select: { objects: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài nguyên trang trí');
    }

    if (existing._count.objects > 0) {
      throw new BadRequestException(
        `Không thể xóa asset "${existing.name}" vì đang có ${existing._count.objects} đối tượng trong bố cục khu vườn sử dụng! Hãy vô hiệu hóa (isActive = false) hoặc thay thế đối tượng trước.`,
      );
    }

    await this.prisma.farmGardenAsset.delete({ where: { id } });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'FARM_GARDEN_ASSET_DELETE',
          target: `FarmGardenAsset:${id}:${existing.code}`,
          oldValue: JSON.stringify(existing),
        },
      });
    }

    return { success: true, message: 'Đã xóa tài nguyên thành công' };
  }
}
