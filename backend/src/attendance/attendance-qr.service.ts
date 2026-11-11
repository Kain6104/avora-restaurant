import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AttendanceQrService {
  constructor(private readonly prisma: PrismaService) {}

  private md5(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  async generateDynamicQr(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại.');
    }

    const secretKey = branch.qrSecretKey || 'DEFAULT_SECRET_WA';
    const timestamp = Math.floor(Date.now() / 1000);
    const rawData = `${branchId}|${timestamp}|${secretKey}`;
    const signature = this.md5(rawData).substring(0, 10);
    const qrData = `${branchId}|${timestamp}|${signature}`;

    return {
      qrData,
      branchId,
      branchName: branch.name,
      timestamp,
      expiresInSeconds: 300,
    };
  }

  async generateStaticQr(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại.');
    }

    const secretKey = branch.qrSecretKey || 'DEFAULT_SECRET_WA';
    const rawData = `STATIC_QR|${branchId}|${secretKey}`;
    const signature = this.md5(rawData).substring(0, 10);
    const qrData = `STATIC_QR|${branchId}|${signature}`;

    return {
      qrData,
      branchId,
      branchName: branch.name,
      address: [branch.street, branch.ward, branch.district, branch.province].filter(Boolean).join(', '),
    };
  }

  async verifyAndExtractBranch(qrCodeData: string): Promise<{ branchId: string; isStatic: boolean }> {
    const parts = qrCodeData.trim().split('|');
    if (parts.length !== 3) {
      throw new BadRequestException('Mã QR không hợp lệ định dạng.');
    }

    if (parts[0] === 'STATIC_QR') {
      const branchId = parts[1];
      const signature = parts[2];

      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new BadRequestException('Chi nhánh không tồn tại trong hệ thống.');
      }

      const secretKey = branch.qrSecretKey || 'DEFAULT_SECRET_WA';
      const rawData = `STATIC_QR|${branchId}|${secretKey}`;
      const expectedSignature = this.md5(rawData).substring(0, 10);

      if (signature !== expectedSignature) {
        throw new BadRequestException('Mã QR tĩnh không hợp lệ hoặc đã bị làm giả!');
      }

      return { branchId, isStatic: true };
    } else {
      const branchId = parts[0];
      const qrTimestamp = parseInt(parts[1], 10);
      const signature = parts[2];

      if (isNaN(qrTimestamp)) {
        throw new BadRequestException('Thời gian trên mã QR không hợp lệ.');
      }

      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new BadRequestException('Chi nhánh không tồn tại trong hệ thống.');
      }

      const secretKey = branch.qrSecretKey || 'DEFAULT_SECRET_WA';
      const rawData = `${branchId}|${qrTimestamp}|${secretKey}`;
      const expectedSignature = this.md5(rawData).substring(0, 10);

      if (signature !== expectedSignature) {
        throw new BadRequestException('Mã QR động không hợp lệ hoặc đã bị can thiệp!');
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDiff = currentTimestamp - qrTimestamp;

      if (timeDiff > 300 || timeDiff < -5) {
        throw new BadRequestException('Mã QR đã hết hạn! Vui lòng quét mã mới nhất trên màn hình tại quán.');
      }

      return { branchId, isStatic: false };
    }
  }
}

