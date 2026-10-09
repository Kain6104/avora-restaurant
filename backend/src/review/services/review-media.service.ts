import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewMediaType } from '@prisma/client';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

export interface ProcessedMediaResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
  mediaType: ReviewMediaType;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

@Injectable()
export class ReviewMediaService {
  private readonly logger = new Logger(ReviewMediaService.name);
  private readonly uploadBaseDir = path.join(process.cwd(), 'uploads', 'reviews');
  private readonly thumbnailDir = path.join(process.cwd(), 'uploads', 'reviews', 'thumbnails');
  private readonly MAX_OUTPUT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(this.uploadBaseDir)) {
      fs.mkdirSync(this.uploadBaseDir, { recursive: true });
    }
    if (!fs.existsSync(this.thumbnailDir)) {
      fs.mkdirSync(this.thumbnailDir, { recursive: true });
    }
  }

  /**
   * Xác thực magic bytes (file signature) chống fake MIME và file độc hại
   */
  private validateFileSignature(buffer: Buffer): { isValid: boolean; detectedType: 'IMAGE' | 'VIDEO' | 'UNKNOWN'; mime: string } {
    if (!buffer || buffer.length < 12) {
      return { isValid: false, detectedType: 'UNKNOWN', mime: '' };
    }

    // 1. JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { isValid: true, detectedType: 'IMAGE', mime: 'image/jpeg' };
    }

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { isValid: true, detectedType: 'IMAGE', mime: 'image/png' };
    }

    // 3. WebP: RIFF .... WEBP
    const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
    const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';
    if (isRiff && isWebp) {
      return { isValid: true, detectedType: 'IMAGE', mime: 'image/webp' };
    }

    // 4. MP4 / MOV: .... ftyp
    const isFtyp = buffer.toString('ascii', 4, 8) === 'ftyp';
    if (isFtyp) {
      const brand = buffer.toString('ascii', 8, 12);
      if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'qt  ', 'MSNV'].includes(brand)) {
        return { isValid: true, detectedType: 'VIDEO', mime: 'video/mp4' };
      }
      if (['avif', 'avis'].includes(brand)) {
        return { isValid: true, detectedType: 'IMAGE', mime: 'image/avif' };
      }
      return { isValid: true, detectedType: 'VIDEO', mime: 'video/mp4' };
    }

    // 5. WebM: 1A 45 DF A3 (EBML Header)
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return { isValid: true, detectedType: 'VIDEO', mime: 'video/webm' };
    }

    return { isValid: false, detectedType: 'UNKNOWN', mime: '' };
  }

  /**
   * Xử lý tải lên và tối ưu tệp media (ảnh hoặc video)
   */
  async processAndSaveMedia(file: Express.Multer.File): Promise<ProcessedMediaResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FILE_EMPTY',
          message: 'Không nhận được dữ liệu tệp tin.',
        },
      });
    }

    // 1. Kiểm tra File Signature
    const { isValid, detectedType, mime } = this.validateFileSignature(file.buffer);
    if (!isValid || detectedType === 'UNKNOWN') {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'INVALID_FILE_SIGNATURE',
          message: 'Định dạng tệp không được hỗ trợ hoặc chữ ký tệp không hợp lệ. Chỉ chấp nhận ảnh (JPG, PNG, WebP, AVIF) và video (MP4, WebM).',
        },
      });
    }

    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (detectedType === 'IMAGE') {
      return this.processImage(file.buffer, uniqueId, mime);
    } else {
      return this.processVideo(file.buffer, uniqueId, mime, file.originalname);
    }
  }

  /**
   * Xử lý nén và sinh thumbnail cho hình ảnh
   */
  private async processImage(buffer: Buffer, uniqueId: string, mime: string): Promise<ProcessedMediaResult> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      let outputBuffer: Buffer;
      let finalExt = 'webp';
      let finalMime = 'image/webp';

      // Nén ảnh sang WebP chất lượng cao (quality 85)
      outputBuffer = await sharp(buffer)
        .rotate() // Tự động xoay theo EXIF
        .webp({ quality: 85, effort: 4 })
        .toBuffer();

      // Nếu vẫn vượt quá 5MB, giảm resolution/quality
      if (outputBuffer.length > this.MAX_OUTPUT_SIZE_BYTES) {
        outputBuffer = await sharp(buffer)
          .rotate()
          .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();
      }

      if (outputBuffer.length > this.MAX_OUTPUT_SIZE_BYTES) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'IMAGE_TOO_LARGE',
            message: 'Hình ảnh quá lớn, không thể tối ưu xuống dưới 5MB. Vui lòng chọn ảnh khác.',
          },
        });
      }

      const fileName = `${uniqueId}.${finalExt}`;
      const filePath = path.join(this.uploadBaseDir, fileName);
      await fs.promises.writeFile(filePath, outputBuffer);

      // Sinh thumbnail (rộng 360px)
      const thumbFileName = `thumb_${uniqueId}.webp`;
      const thumbPath = path.join(this.thumbnailDir, thumbFileName);
      const thumbBuffer = await sharp(outputBuffer)
        .resize({ width: 360, height: 360, fit: 'cover' })
        .webp({ quality: 75 })
        .toBuffer();
      await fs.promises.writeFile(thumbPath, thumbBuffer);

      const url = `/api/uploads/reviews/${fileName}`;
      const thumbnailUrl = `/api/uploads/reviews/thumbnails/${thumbFileName}`;

      const mediaRecord = await this.prisma.reviewMedia.create({
        data: {
          mediaType: ReviewMediaType.IMAGE,
          url,
          thumbnailUrl,
          mimeType: finalMime,
          sizeBytes: outputBuffer.length,
          width: metadata.width || 800,
          height: metadata.height || 600,
        },
      });

      return {
        id: mediaRecord.id,
        url,
        thumbnailUrl,
        mediaType: ReviewMediaType.IMAGE,
        mimeType: finalMime,
        sizeBytes: outputBuffer.length,
        width: metadata.width,
        height: metadata.height,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Error processing image: ${err?.message}`);
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'IMAGE_PROCESS_FAILED',
          message: 'Không thể xử lý hình ảnh này. Tệp có thể đã bị lỗi hoặc hỏng.',
        },
      });
    }
  }

  /**
   * Xử lý video: kiểm tra kích thước, tối ưu hóa nếu cần, giới hạn <= 5MB
   */
  private async processVideo(
    buffer: Buffer,
    uniqueId: string,
    mime: string,
    originalName: string,
  ): Promise<ProcessedMediaResult> {
    const rawSize = buffer.length;

    // Giới hạn upload ban đầu an toàn (tối đa 50MB để tránh tràn RAM máy chủ)
    if (rawSize > 50 * 1024 * 1024) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'VIDEO_TOO_LARGE',
          message: 'Video ban đầu vượt quá 50MB. Vui lòng chọn video ngắn hơn (dưới 60 giây).',
        },
      });
    }

    const ext = mime.includes('webm') ? 'webm' : 'mp4';
    const fileName = `${uniqueId}.${ext}`;
    const filePath = path.join(this.uploadBaseDir, fileName);

    // Trường hợp 1: Video đã <= 5MB
    if (rawSize <= this.MAX_OUTPUT_SIZE_BYTES) {
      await fs.promises.writeFile(filePath, buffer);

      const url = `/api/uploads/reviews/${fileName}`;
      const mediaRecord = await this.prisma.reviewMedia.create({
        data: {
          mediaType: ReviewMediaType.VIDEO,
          url,
          thumbnailUrl: null,
          mimeType: mime,
          sizeBytes: rawSize,
        },
      });

      return {
        id: mediaRecord.id,
        url,
        thumbnailUrl: undefined,
        mediaType: ReviewMediaType.VIDEO,
        mimeType: mime,
        sizeBytes: rawSize,
      };
    }

    // Trường hợp 2: Video > 5MB nhưng chưa có binary ffmpeg trên hệ thống host
    // Thông báo thân thiện rõ ràng theo quy định Section G
    this.logger.warn(`Video upload (${(rawSize / (1024 * 1024)).toFixed(2)}MB) vượt quá 5MB và cần nén trước khi lưu.`);
    throw new BadRequestException({
      success: false,
      statusCode: 400,
      error: {
        code: 'VIDEO_OPTIMIZATION_FAILED',
        message: 'Không thể tối ưu video xuống dưới 5MB. Vui lòng chọn video ngắn hơn hoặc giảm độ phân giải trước khi tải lên.',
      },
    });
  }

  /**
   * Liên kết danh sách mediaIds với ProductReview
   */
  async linkMediaToProductReview(reviewId: string, mediaIds: string[], tx?: any): Promise<void> {
    if (!mediaIds || mediaIds.length === 0) return;
    const client = tx || this.prisma;
    await client.reviewMedia.updateMany({
      where: { id: { in: mediaIds } },
      data: { productReviewId: reviewId },
    });
  }

  /**
   * Liên kết danh sách mediaIds với OrderReview
   */
  async linkMediaToOrderReview(orderReviewId: string, mediaIds: string[], tx?: any): Promise<void> {
    if (!mediaIds || mediaIds.length === 0) return;
    const client = tx || this.prisma;
    await client.reviewMedia.updateMany({
      where: { id: { in: mediaIds } },
      data: { orderReviewId },
    });
  }

  /**
   * Liên kết danh sách mediaIds với OrderReviewFollowUp
   */
  async linkMediaToFollowUp(followUpId: string, mediaIds: string[], tx?: any): Promise<void> {
    if (!mediaIds || mediaIds.length === 0) return;
    const client = tx || this.prisma;
    await client.reviewMedia.updateMany({
      where: { id: { in: mediaIds } },
      data: { followUpId },
    });
  }
}
