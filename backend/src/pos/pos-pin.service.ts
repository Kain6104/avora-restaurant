import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { getRequiredEnv } from '../common/utils/env.util';

interface FailedAttemptInfo {
  count: number;
  lockedUntil: number;
}

@Injectable()
export class PosPinService {
  private readonly pinSecret: string;
  private readonly failedAttempts = new Map<string, FailedAttemptInfo>();

  private readonly WEAK_PINS = new Set([
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    '1234', '4321', '0123', '9876',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.pinSecret = getRequiredEnv('POS_PIN_LOOKUP_SECRET');
  }

  /**
   * Tính toán mã tra cứu HMAC-SHA256 bí mật cho PIN 4 số.
   * Mã hóa một chiều và xác định, cho phép index @unique trong database mà không lộ plaintext PIN.
   */
  public calculatePinLookup(pin: string): string {
    const normalizedPin = pin.trim();
    return crypto
      .createHmac('sha256', this.pinSecret)
      .update(normalizedPin)
      .digest('hex');
  }

  /**
   * Kiểm tra mã PIN có thuộc danh sách PIN yếu/dễ đoán hay không.
   */
  public isWeakPin(pin: string): boolean {
    return this.WEAK_PINS.has(pin.trim());
  }

  /**
   * Anti-Brute-Force Rate Limiting cho mã PIN.
   * Nếu sai 5 lần, khóa trong 30 giây.
   */
  private checkRateLimit(key: string): void {
    const info = this.failedAttempts.get(key);
    if (!info) return;

    const now = Date.now();
    if (info.lockedUntil > now) {
      const remainingSec = Math.ceil((info.lockedUntil - now) / 1000);
      throw new UnauthorizedException({
        code: 'POS_PIN_RATE_LIMITED',
        message: `Đã nhập sai PIN nhiều lần. Vui lòng thử lại sau ${remainingSec} giây hoặc đăng nhập bằng mật khẩu.`,
        retryAfter: remainingSec,
      });
    }

    // Nếu thời gian khóa đã trôi qua, reset lại số lần nếu quá 5 phút không hoạt động
    if (now - info.lockedUntil > 5 * 60 * 1000) {
      this.failedAttempts.delete(key);
    }
  }

  private recordFailedAttempt(key: string, clientIp?: string): void {
    const now = Date.now();
    const info = this.failedAttempts.get(key) || { count: 0, lockedUntil: 0 };
    info.count += 1;

    if (info.count >= 5) {
      const lockDurationSec = Math.min(30 * Math.pow(2, info.count - 5), 300); // 30s, 60s, 120s... max 300s
      info.lockedUntil = now + lockDurationSec * 1000;

      // Ghi audit log khi bị rate limited
      this.logAuditSafe({
        userId: '00000000-0000-0000-0000-000000000000',
        action: 'POS_PIN_RATE_LIMITED',
        target: `Rate limit triggered for key: ${key}`,
        ipAddress: clientIp || null,
      });
    }

    this.failedAttempts.set(key, info);
  }

  private resetRateLimit(key: string): void {
    this.failedAttempts.delete(key);
  }

  /**
   * Đăng ký / Xác thực kết nối từ máy trạm AVORA POS Desktop (Trusted Device Handshake).
   */
  public async handshakeDevice(data: {
    deviceId: string;
    machineName?: string;
  }): Promise<{ deviceId: string; deviceSecret: string }> {
    if (!data.deviceId || typeof data.deviceId !== 'string' || !data.deviceId.trim()) {
      throw new BadRequestException('Mã thiết bị không hợp lệ.');
    }

    const cleanDeviceId = data.deviceId.trim();
    const existing = await this.prisma.posDevice.findUnique({
      where: { deviceId: cleanDeviceId },
    });

    if (existing) {
      await this.prisma.posDevice.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          name: data.machineName?.trim() || existing.name,
        },
      });
      return {
        deviceId: existing.deviceId,
        deviceSecret: existing.deviceSecret,
      };
    }

    // Thiết bị mới: Tạo khóa bí mật thiết bị ngẫu nhiên an toàn
    const generatedSecret = crypto.randomBytes(32).toString('hex');
    const newDevice = await this.prisma.posDevice.create({
      data: {
        deviceId: cleanDeviceId,
        deviceSecret: generatedSecret,
        name: data.machineName?.trim() || 'AVORA POS Desktop Terminal',
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    return {
      deviceId: newDevice.deviceId,
      deviceSecret: newDevice.deviceSecret,
    };
  }

  /**
   * Kiểm tra chứng thực thiết bị POS tin cậy.
   * Ngăn chặn hoàn toàn truy cập PIN login từ trình duyệt web thông thường.
   */
  public async validateTrustedDevice(
    deviceId?: string,
    deviceSecret?: string,
  ): Promise<boolean> {
    if (!deviceId || !deviceSecret) return false;

    try {
      const device = await this.prisma.posDevice.findUnique({
        where: { deviceId: deviceId.trim() },
      });

      if (!device || !device.isActive) return false;
      return device.deviceSecret === deviceSecret.trim();
    } catch {
      return false;
    }
  }

  /**
   * Xác thực đăng nhập nhanh bằng mã PIN 4 số.
   */
  public async loginWithPin(
    pin: string,
    deviceId?: string,
    deviceSecret?: string,
    clientIp?: string,
  ): Promise<{ success: boolean; message: string; access_token: string; user: any }> {
    // 1. Kiểm tra Trusted POS Device
    const isTrusted = await this.validateTrustedDevice(deviceId, deviceSecret);
    if (!isTrusted) {
      throw new ForbiddenException(
        'Chỉ ứng dụng AVORA POS Desktop đã xác thực mới được phép sử dụng tính năng đăng nhập bằng mã PIN.',
      );
    }

    // 2. Kiểm tra định dạng PIN
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
      throw new BadRequestException('Mã PIN phải bao gồm đúng 4 chữ số (0-9).');
    }

    const cleanPin = pin.trim();
    const rateLimitKey = `${deviceId || 'unknown'}:${clientIp || '127.0.0.1'}`;

    // 3. Kiểm tra Anti-Brute-Force
    this.checkRateLimit(rateLimitKey);

    // 4. Tính toán HMAC lookup
    const lookup = this.calculatePinLookup(cleanPin);

    // 5. Tìm duy nhất User theo lookup
    const user = await this.prisma.user.findUnique({
      where: { posPinLookup: lookup },
    });

    if (!user || !user.posPinEnabled || !user.posPinHash) {
      this.recordFailedAttempt(rateLimitKey, clientIp);
      this.logAuditSafe({
        userId: '00000000-0000-0000-0000-000000000000',
        action: 'POS_PIN_LOGIN_FAILED',
        target: 'Invalid PIN lookup attempt',
        ipAddress: clientIp || null,
      });
      throw new UnauthorizedException('Mã PIN không chính xác.');
    }

    // 6. Kiểm tra hash bcrypt
    const isHashValid = await bcrypt.compare(cleanPin, user.posPinHash);
    if (!isHashValid) {
      this.recordFailedAttempt(rateLimitKey, clientIp);
      this.logAuditSafe({
        userId: user.id,
        action: 'POS_PIN_LOGIN_FAILED',
        target: 'PIN hash mismatch',
        ipAddress: clientIp || null,
      });
      throw new UnauthorizedException('Mã PIN không chính xác.');
    }

    // 7. Kiểm tra trạng thái tài khoản
    if (user.isAccountLocked) {
      throw new UnauthorizedException('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
    }

    // Tự động xóa cờ forceRelogin khi xác thực danh tính bằng mã PIN thành công
    if (user.forceRelogin) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { forceRelogin: false },
      });
    }


    // 8. Đăng nhập thành công -> Reset rate limit
    this.resetRateLimit(rateLimitKey);

    // Ghi audit log
    this.logAuditSafe({
      userId: user.id,
      action: 'POS_PIN_LOGIN_SUCCESS',
      target: `POS fast login on device ${deviceId || 'unknown'}`,
      ipAddress: clientIp || null,
    });

    // 9. Cấp JWT token chuẩn (đồng bộ RBAC)
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      success: true,
      message: 'Đăng nhập thành công',
      access_token: accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Che mờ email hiển thị an toàn trên giao diện.
   * Ví dụ: contact@avora.vn -> c***t@avora.vn
   */
  public maskEmail(email: string): string {
    if (!email || !email.includes('@')) return 'email***';
    const [name, domain] = email.split('@');
    if (name.length <= 2) {
      return `${name.charAt(0)}***@${domain}`;
    }
    return `${name.charAt(0)}***${name.charAt(name.length - 1)}@${domain}`;
  }

  /**
   * Gửi email mã OTP xác thực thao tác PIN POS.
   */
  private async sendOtpMail(email: string, fullName: string, otp: string) {
    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"AVORA Restaurant Security" <${process.env.SMTP_USER}>`,
          to: email,
          subject: '[AVORA POS] Mã xác thực OTP cài đặt mã PIN đăng nhập nhanh',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #da251d, #991b1b); padding: 24px; text-align: center;">
                <h2 style="color: white; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">XÁC THỰC MÃ PIN AVORA POS</h2>
              </div>
              <div style="padding: 24px 28px;">
                <p>Xin chào <strong>${fullName || 'Quý nhân viên'}</strong>,</p>
                <p>Hệ thống nhận được yêu cầu thiết lập / thay đổi / xóa mã PIN đăng nhập nhanh tại thiết bị bán hàng AVORA POS cho tài khoản của bạn.</p>
                <p>Vui lòng sử dụng mã OTP gồm 6 chữ số dưới đây để hoàn tất xác thực:</p>
                
                <div style="text-align: center; margin: 28px 0;">
                  <span style="font-size: 34px; font-weight: bold; letter-spacing: 6px; color: #da251d; background-color: #fee2e2; padding: 14px 28px; border-radius: 10px; border: 1px dashed #ef4444; display: inline-block;">${otp}</span>
                </div>

                <p style="font-size: 13px; color: #64748b;">• Mã xác thực này có hiệu lực trong vòng <strong>5 phút</strong>.<br/>• Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả quản trị viên.</p>
              </div>
              <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0;">AVORA POS System • Hệ thống bảo mật điểm bán hàng</p>
              </div>
            </div>
          `,
        });
      }
      console.log(`\n\n======================================================`);
      console.log(`=== OTP XÁC THỰC MÃ PIN POS CHO [${email}] LÀ: [${otp}] ===`);
      console.log(`======================================================\n\n`);
    } catch (err) {
      console.error('Lỗi khi gửi email OTP PIN:', err);
      console.log(`\n\n=== [FALLBACK LOG] OTP PIN CHO [${email}] LÀ: [${otp}] ===\n\n`);
    }
  }

  /**
   * Tạo và gửi mã OTP 6 số về Email của người dùng đang đăng nhập.
   */
  public async sendPinOtp(userId: string): Promise<{ success: boolean; message: string; maskedEmail: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }

    if (!user.email) {
      throw new BadRequestException('Tài khoản của bạn chưa được liên kết email để nhận mã xác thực OTP.');
    }

    const now = new Date();
    // Cooldown 45 giây chống spam gửi liên tục
    if (user.posPinOtpLastSentAt && (now.getTime() - user.posPinOtpLastSentAt.getTime() < 45000)) {
      const waitSec = Math.ceil((45000 - (now.getTime() - user.posPinOtpLastSentAt.getTime())) / 1000);
      throw new BadRequestException(`Vui lòng đợi ${waitSec} giây trước khi yêu cầu gửi lại mã OTP.`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        posPinOtp: otp,
        posPinOtpExpires: expires,
        posPinOtpAttempts: 0,
        posPinOtpLastSentAt: now,
      },
    });

    await this.sendOtpMail(user.email, user.fullName, otp);

    const masked = this.maskEmail(user.email);
    return {
      success: true,
      message: `Mã OTP 6 số đã được gửi tới email ${masked}. Vui lòng kiểm tra hộp thư!`,
      maskedEmail: masked,
    };
  }

  /**
   * Xác thực danh tính người dùng: Hỗ trợ xác nhận bằng Mật khẩu HOẶC mã OTP gửi về email.
   */
  private async verifyUserIdentity(
    user: any,
    password?: string,
    otp?: string,
  ): Promise<void> {
    const hasOtp = typeof otp === 'string' && otp.trim().length > 0;
    const hasPassword = typeof password === 'string' && password.trim().length > 0;

    if (!hasOtp && !hasPassword) {
      throw new BadRequestException('Vui lòng nhập mật khẩu tài khoản hoặc mã OTP 6 số để xác nhận.');
    }

    // Nếu người dùng xác thực bằng mã OTP
    if (hasOtp) {
      const cleanOtp = otp!.trim();
      if (!user.posPinOtp || !user.posPinOtpExpires || new Date() > user.posPinOtpExpires) {
        throw new BadRequestException('Mã OTP đã hết hạn hoặc chưa được tạo. Vui lòng bấm "Gửi mã OTP".');
      }

      if (user.posPinOtpAttempts >= 5) {
        throw new BadRequestException('Mã OTP đã bị khóa do nhập sai quá 5 lần. Vui lòng bấm gửi lại mã mới.');
      }

      if (user.posPinOtp !== cleanOtp) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { posPinOtpAttempts: { increment: 1 } },
        });
        throw new BadRequestException('Mã OTP 6 số không chính xác.');
      }

      // Xóa OTP sau khi xác thực thành công
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          posPinOtp: null,
          posPinOtpExpires: null,
          posPinOtpAttempts: 0,
        },
      });
      return;
    }

    // Nếu người dùng xác thực bằng Mật khẩu
    if (hasPassword) {
      if (!user.passwordHash || !(await bcrypt.compare(password!.trim(), user.passwordHash))) {
        throw new UnauthorizedException('Mật khẩu tài khoản không chính xác.');
      }
      return;
    }
  }

  /**
   * Lấy trạng thái PIN của tài khoản hiện tại.
   */
  public async getPinStatus(userId: string): Promise<{ hasPin: boolean; updatedAt: Date | null; maskedEmail: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { posPinEnabled: true, posPinUpdatedAt: true, email: true },
    });

    return {
      hasPin: user?.posPinEnabled ?? false,
      updatedAt: user?.posPinUpdatedAt ?? null,
      maskedEmail: user?.email ? this.maskEmail(user.email) : null,
    };
  }

  /**
   * Thiết lập mã PIN lần đầu (Xác thực bằng Mật khẩu HOẶC OTP).
   */
  public async setupPin(
    userId: string,
    payload: { password?: string; otp?: string; pin: string },
    clientIp?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại.');

    // 1. Xác thực danh tính bằng Password hoặc OTP
    await this.verifyUserIdentity(user, payload.password, payload.otp);

    // 2. Validate mã PIN
    const { pin } = payload;
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
      throw new BadRequestException('Mã PIN phải bao gồm đúng 4 chữ số (0-9).');
    }

    const cleanPin = pin.trim();
    if (this.isWeakPin(cleanPin)) {
      throw new BadRequestException('Mã PIN quá dễ đoán (0000, 1234...). Vui lòng chọn 4 chữ số khác an toàn hơn.');
    }

    const lookup = this.calculatePinLookup(cleanPin);

    // 3. Kiểm tra tính duy nhất toàn hệ thống
    const existing = await this.prisma.user.findUnique({
      where: { posPinLookup: lookup },
    });

    if (existing && existing.id !== userId) {
      throw new ConflictException({
        code: 'POS_PIN_ALREADY_IN_USE',
        message: 'Mã PIN này đã được sử dụng. Vui lòng chọn mã PIN khác.',
      });
    }

    const hash = await bcrypt.hash(cleanPin, 10);

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          posPinEnabled: true,
          posPinHash: hash,
          posPinLookup: lookup,
          posPinUpdatedAt: new Date(),
          forceRelogin: false,
        },
      });

      this.logAuditSafe({
        userId,
        action: 'POS_PIN_CREATED',
        target: 'Created new POS PIN',
        ipAddress: clientIp || null,
      });

      return { success: true, message: 'Thiết lập mã PIN POS thành công.' };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({
          code: 'POS_PIN_ALREADY_IN_USE',
          message: 'Mã PIN này đã được sử dụng. Vui lòng chọn mã PIN khác.',
        });
      }
      throw err;
    }
  }

  /**
   * Đổi mã PIN (Xác thực bằng Mật khẩu HOẶC OTP).
   */
  public async changePin(
    userId: string,
    payload: { password?: string; otp?: string; newPin: string },
    clientIp?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.setupPin(userId, { ...payload, pin: payload.newPin }, clientIp);
  }

  /**
   * Xóa mã PIN của tài khoản (Xác thực bằng Mật khẩu HOẶC OTP).
   */
  public async removePin(
    userId: string,
    payload: { password?: string; otp?: string },
    clientIp?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại.');

    // Xác thực danh tính bằng Password hoặc OTP
    await this.verifyUserIdentity(user, payload.password, payload.otp);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        posPinEnabled: false,
        posPinHash: null,
        posPinLookup: null,
        posPinUpdatedAt: new Date(),
      },
    });

    this.logAuditSafe({
      userId,
      action: 'POS_PIN_REMOVED',
      target: 'Removed POS PIN',
      ipAddress: clientIp || null,
    });

    return { success: true, message: 'Đã xóa mã PIN POS thành công.' };
  }


  private async logAuditSafe(data: {
    userId: string;
    action: string;
    target: string;
    ipAddress: string | null;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          target: data.target,
          ipAddress: data.ipAddress,
        },
      });
    } catch {
      // Non-fatal
    }
  }
}
