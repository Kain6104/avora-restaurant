import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BankCryptoService } from '../services/bank-crypto.service';

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  private readonly logger = new Logger(DeviceAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankCrypto: BankCryptoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const deviceId = request.headers['x-device-id'];
    const signature = request.headers['x-signature'];
    const timestamp = request.headers['x-timestamp'];
    const nonce = request.headers['x-nonce'];

    if (!deviceId || !signature || !timestamp || !nonce) {
      this.logger.warn('Thiếu headers xác thực thiết bị (x-device-id, x-signature, x-timestamp, x-nonce)');
      throw new UnauthorizedException('Missing required security headers');
    }

    // 1. Kiểm tra thiết bị trong Database
    const device = await this.prisma.bankConnectedDevice.findUnique({
      where: { deviceId: String(deviceId) },
    });

    if (!device) {
      this.logger.warn(`Thiết bị không tồn tại: ${deviceId}`);
      throw new UnauthorizedException('Thiết bị chưa được đăng ký hoặc không tồn tại');
    }

    if (device.status !== 'ACTIVE') {
      this.logger.warn(`Thiết bị đã bị vô hiệu hóa (${device.status}): ${deviceId}`);
      throw new UnauthorizedException(`Thiết bị đã bị thu hồi hoặc tạm ngưng (${device.status})`);
    }

    // 2. Kiểm tra timestamp window & nonce replay attack
    this.bankCrypto.validateTimestampAndNonce(String(timestamp), String(nonce));

    // 3. Chuẩn hóa payload body
    const bodyStr = request.body ? JSON.stringify(request.body) : '';
    const canonicalMessage = this.bankCrypto.createCanonicalString(
      String(deviceId),
      String(timestamp),
      String(nonce),
      bodyStr,
    );

    // 4. Xác thực chữ ký số ECDSA SHA256withECDSA
    const isValid = this.bankCrypto.verifySignature(
      canonicalMessage,
      String(signature),
      device.publicKeyPem,
    );

    if (!isValid) {
      this.logger.warn(`Chữ ký số không hợp lệ từ thiết bị: ${deviceId}`);
      throw new UnauthorizedException('Chữ ký số không hợp lệ');
    }

    // Gắn thông tin device vào request để các handler sử dụng
    request.device = device;
    return true;
  }
}

