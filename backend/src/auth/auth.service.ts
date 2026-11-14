import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { NotificationService } from '../notification/notification.service';
import * as nodemailer from 'nodemailer';

import { AuthorizationService } from '../common/services/authorization.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
    private authorizationService: AuthorizationService,
  ) { }

  private async generateNextMemberCode(): Promise<string> {
    const lastUser = await this.prisma.user.findFirst({
      where: { memberCode: { startsWith: '6868' } },
      orderBy: { memberCode: 'desc' }
    });
    if (!lastUser || !lastUser.memberCode) return '6868000001';
    const currentNum = parseInt(lastUser.memberCode.substring(4), 10);
    return `6868${(currentNum + 1).toString().padStart(6, '0')}`;
  }

  private async sendVerificationEmail(email: string, fullName: string, otp: string) {
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
          from: `"Avora Restaurant" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Mã xác nhận tài khoản Avora Restaurant',
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                   <div style="background-color: #dc2626; padding: 20px; text-align: center;">
                     <h2 style="color: white; margin: 0;">XÁC THỰC TÀI KHOẢN</h2>
                   </div>
                   <div style="padding: 20px;">
                     <p>Xin chào <strong>${fullName}</strong>,</p>
                     <p>Bạn vừa đăng ký tài khoản tại <strong>Avora Restaurant</strong>. Để hoàn tất đăng ký và bảo mật tài khoản, vui lòng sử dụng mã xác nhận (OTP) sau:</p>
                     
                     <div style="text-align: center; margin: 30px 0;">
                       <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #dc2626; background-color: #fee2e2; padding: 15px 30px; border-radius: 8px;">${otp}</span>
                     </div>

                     <p>Mã này có hiệu lực trong vòng <strong>5 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
                   </div>
                   <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                     <p style="margin: 0;">Cảm ơn bạn đã đồng hành cùng Avora Restaurant!</p>
                     <p style="margin: 5px 0 0 0;">Hotline hỗ trợ: <strong>1900 1234</strong></p>
                   </div>
                 </div>`,
        });
      } else {
        console.log(`\n\n=== OTP XÁC THỰC CỦA ${email} LÀ: ${otp} ===\n\n`);
      }
    } catch (e) {
      console.error('Error sending verification email', e);
      console.log(`\n\n=== OTP XÁC THỰC CỦA ${email} LÀ: ${otp} ===\n\n`);
    }
  }

  async register(data: any) {
    const { email, password, fullName, phone } = data;

    // Ràng buộc số điện thoại: đúng 10 số, đầu số VN hợp lệ
    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (!phone || !phoneRegex.test(phone.trim())) {
      throw new BadRequestException('Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 số (bắt đầu bằng 03, 05, 07, 08, 09).');
    }

    // Kiểm tra xem email đã tồn tại chưa
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone }
        ]
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email này đã được sử dụng.');
      }
      if (existingUser.phone === phone) {
        throw new ConflictException('Số điện thoại này đã được sử dụng.');
      }
    }

    // Mã hóa mật khẩu
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const memberCode = await this.generateNextMemberCode();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);

    // Tạo user mới
    const newUser = await this.prisma.user.create({
      data: {
        email,
        fullName,
        phone,
        passwordHash,
        role: 'USER',
        memberCode,
        isEmailVerified: false,
        verificationOtp: otp,
        verificationOtpExpires: expires,
        verificationOtpLastSentAt: new Date(),
      },
    });

    this.sendVerificationEmail(email, fullName, otp);

    return {
      message: 'Vui lòng kiểm tra email để nhận mã xác thực.',
      requiresVerification: true,
      email: newUser.email,
    };
  }

  async login(data: any) {
    const { email, password } = data; // 'email' acts as identifier here

    if (!email || !password) {
      throw new UnauthorizedException('Vui lòng nhập email/số điện thoại và mật khẩu.');
    }

    // Tìm user theo email hoặc phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { phone: email }
        ]
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email, số điện thoại hoặc mật khẩu không chính xác.');
    }

    if (!user.passwordHash) {
      if (user.authProvider === 'GOOGLE') {
        throw new UnauthorizedException('Tài khoản này được liên kết với Google. Vui lòng đăng nhập bằng Google.');
      }
      throw new UnauthorizedException('Tài khoản không có mật khẩu. Vui lòng đăng nhập bằng phương thức khác.');
    }

    // So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email, số điện thoại hoặc mật khẩu không chính xác.');
    }

    if (user.isAccountLocked) {
      throw new UnauthorizedException('Tài khoản đã bị khóa.');
    }

    if (!user.isEmailVerified) {
      const now = new Date();
      if (user.verificationOtpLastSentAt && (now.getTime() - user.verificationOtpLastSentAt.getTime() < 60000)) {
        throw new UnauthorizedException({ message: 'Vui lòng chờ 1 phút trước khi yêu cầu gửi lại mã.', requiresVerification: true, email: user.email });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date();
      expires.setMinutes(expires.getMinutes() + 5);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          verificationOtp: otp,
          verificationOtpExpires: expires,
          verificationOtpAttempts: 0,
          verificationOtpLastSentAt: now,
        }
      });

      this.sendVerificationEmail(user.email, user.fullName, otp);

      throw new UnauthorizedException({ message: 'Tài khoản chưa được xác thực. Chúng tôi đã gửi lại mã OTP vào email của bạn.', requiresVerification: true, email: user.email });
    }

    // Xóa cờ forceRelogin khi đăng nhập thành công
    if (user.forceRelogin) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { forceRelogin: false },
      });
    }

    // Tạo Payload cho JWT
    const payload = { sub: user.id, email: user.email, role: user.role, jti: crypto.randomUUID() };

    return {
      message: 'Đăng nhập thành công',
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      }
    };
  }

  decodeTokenSafely(token: string): any {
    try {
      return this.jwtService.decode(token);
    } catch {
      return null;
    }
  }

  async handleLogoutRevocation(options: {
    deviceInstallationId?: string;
    endpoint?: string;
    sessionId?: string;
    userId?: string;
  }) {
    const { deviceInstallationId, endpoint, sessionId, userId } = options;
    const conditions: any[] = [];
    if (deviceInstallationId) conditions.push({ deviceInstallationId });
    if (endpoint) conditions.push({ endpoint });
    if (sessionId) conditions.push({ sessionId });

    if (conditions.length > 0) {
      try {
        await this.prisma.webPushSubscription.updateMany({
          where: {
            OR: conditions,
            status: 'ACTIVE',
            ...(userId ? { userId } : {}),
          },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
          },
        });
      } catch (err) {
        // Safe fail-through
      }
    }
  }

  async validateGoogleUser(profile: any) {
    const { email, firstName, lastName, picture, googleId } = profile;
    const fullName = `${firstName} ${lastName}`.trim();

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const memberCode = await this.generateNextMemberCode();

      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          fullName,
          avatarUrl: picture,
          googleId,
          authProvider: 'GOOGLE',
          role: 'USER',
          memberCode,
          isEmailVerified: true,
        },
      });

      // Tạo thông báo chào mừng
      await this.notificationService.createNotification({
        userId: user.id,
        title: 'Chào mừng bạn đến với Avora!',
        content: 'Tài khoản của bạn đã được đăng ký qua Google thành công. Hãy khám phá các món ăn tuyệt vời của chúng tôi nhé!',
        type: 'SYSTEM',
      });
    } else {
      if (user.isAccountLocked) {
        throw new UnauthorizedException('Tài khoản đã bị khóa.');
      }
      // Update existing user with Google info if missing
      user = await this.prisma.user.update({
        where: { email },
        data: {
          googleId: user.googleId || googleId,
          avatarUrl: user.avatarUrl || picture,
        },
      });
    }

    return user;
  }

  /**
   * Xác minh Google ID Token cho Khách hàng (QR Ordering / Web)
   * Bắt buộc kiểm tra chữ ký Google tokeninfo, aud == GOOGLE_CLIENT_ID, iss hợp lệ, email_verified == true.
   */
  async verifyCustomerGoogleIdToken(idToken: string) {
    const expectedClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!expectedClientId) {
      throw new BadRequestException({
        success: false,
        code: 'GOOGLE_AUTH_NOT_CONFIGURED',
        message: 'Đăng nhập Google chưa được cấu hình trên hệ thống.',
      });
    }

    if (!idToken || typeof idToken !== 'string' || idToken.trim().length < 20) {
      throw new UnauthorizedException('Google ID Token không hợp lệ hoặc bị thiếu.');
    }

    let payload: any;
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`,
      );
      if (!response.ok) {
        throw new Error(`Google tokeninfo HTTP ${response.status}`);
      }
      payload = await response.json();
    } catch {
      throw new UnauthorizedException('Google ID Token không hợp lệ hoặc đã hết hạn.');
    }

    const validIssuers = new Set(['accounts.google.com', 'https://accounts.google.com']);
    if (!payload?.iss || !validIssuers.has(String(payload.iss))) {
      throw new UnauthorizedException('Nguồn cấp Google Token không hợp lệ.');
    }

    if (payload.aud !== expectedClientId) {
      throw new UnauthorizedException('Google Token không thuộc ứng dụng AVORA.');
    }

    const isEmailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!payload?.email || !isEmailVerified || !payload?.sub) {
      throw new UnauthorizedException('Tài khoản Google chưa xác minh email hợp lệ.');
    }

    const normalizedEmail = String(payload.email).toLowerCase().trim();
    const googleId = String(payload.sub).trim();

    // Lookup safely by googleId OR normalized email to guarantee zero duplicate accounts
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email: normalizedEmail }],
      },
      include: { membershipTier: true },
    });

    if (!user) {
      const memberCode = await this.generateNextMemberCode();
      const fullName =
        [payload.given_name, payload.family_name].filter(Boolean).join(' ').trim() ||
        payload.name?.trim() ||
        normalizedEmail.split('@')[0];

      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName,
          avatarUrl: payload.picture || null,
          googleId,
          authProvider: 'GOOGLE',
          role: 'USER',
          memberCode,
          isEmailVerified: true,
        },
        include: { membershipTier: true },
      });

      await this.notificationService
        .createNotification({
          userId: user.id,
          title: 'Chào mừng bạn đến với Avora!',
          content:
            'Tài khoản của bạn đã được đăng ký qua Google thành công. Hãy tích điểm và nhận ưu đãi thành viên tại AVORA!',
          type: 'SYSTEM',
        })
        .catch(() => { });
    } else {
      if (user.isAccountLocked) {
        throw new UnauthorizedException('Tài khoản đã bị khóa.');
      }
      // Link googleId safely without modifying role, passwordHash, or phone
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId || googleId,
          avatarUrl: user.avatarUrl || payload.picture || null,
          isEmailVerified: true,
        },
        include: { membershipTier: true },
      });
    }

    return user;
  }

  /**
   * Xác minh Google ID Token cho Android App và kiểm tra quyền Quản trị viên (ADMIN)
   */
  async verifyGoogleIdTokenForAdmin(idToken: string) {
    let payload: any;
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!response.ok) {
        throw new Error('Google tokeninfo verification failed');
      }
      payload = await response.json();
    } catch (e: any) {
      throw new UnauthorizedException({
        success: false,
        message: 'Google ID Token không hợp lệ hoặc đã hết hạn.',
      });
    }

    if (!payload?.email) {
      throw new UnauthorizedException({
        success: false,
        message: 'Google ID Token không chứa thông tin email hợp lệ.',
      });
    }

    const email = payload.email.toLowerCase().trim();

    // 1. Tìm user trong hệ thống AVORA
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { googleId: payload.sub }
        ]
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message: `Tài khoản Google (${email}) chưa được kích hoạt trong hệ thống AVORA. Vui lòng liên hệ Quản trị viên.`,
      });
    }

    if (user.isAccountLocked) {
      throw new ForbiddenException({
        success: false,
        message: 'Tài khoản này đã bị khóa trong hệ thống AVORA.',
      });
    }

    // 2. Bắt buộc kiểm tra quyền ADMIN / SUPER_ADMIN / MANAGER
    const role = (user.role || '').toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER';
    if (!isAdmin) {
      throw new ForbiddenException({
        success: false,
        message: `Tài khoản Google (${email}) có vai trò [${role}], không có quyền Quản trị viên (ADMIN) để truy cập Gateway.`,
      });
    }

    // 3. Liên kết googleId nếu chưa có
    if (!user.googleId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
          authProvider: user.authProvider || 'GOOGLE',
          avatarUrl: user.avatarUrl || payload.picture,
        },
      });
    }

    // 4. Tạo JWT payload và trả về phiên đăng nhập
    const jwtPayload = { sub: user.id, email: user.email, role: user.role, jti: crypto.randomUUID() };
    const token = this.jwtService.sign(jwtPayload);

    return {
      success: true,
      message: 'Đăng nhập Google thành công với quyền Quản trị viên.',
      access_token: token,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async updatePhone(userId: string, phone: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Số điện thoại này đã được sử dụng bởi một tài khoản khác.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { phone },
    });

    return updatedUser;
  }

  generateToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role, jti: crypto.randomUUID() };
    return this.jwtService.sign(payload);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
        },
        membershipTier: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    const { passwordHash, ...result } = user;
    const capabilities = await this.authorizationService.getCapabilities(userId);
    const token = this.generateToken(user);
    const effectiveRole = capabilities.user?.role || result.role;
    const effectiveRoleName = capabilities.user?.roleName || (effectiveRole === 'ADMIN' ? 'Quản trị viên toàn quyền' : 'Nhân viên');

    return {
      ...result,
      role: effectiveRole,
      roleName: effectiveRoleName,
      token,
      hasPassword: !!passwordHash,
      permissions: Object.keys(capabilities.effectivePermissions),
      roles: capabilities.roles,
      assignments: capabilities.assignments,
      effectivePermissions: capabilities.effectivePermissions,
      allBranches: capabilities.allBranches,
      capabilities,
    };
  }

  async getCapabilities(userId: string) {
    return this.authorizationService.getCapabilities(userId);
  }

  async addPassword(userId: string, newPassword: string) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Đã thêm mật khẩu thành công' };
  }

  async changePassword(userId: string, data: any) {
    const { oldPassword, newPassword } = data;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Không tìm thấy người dùng hoặc người dùng chưa có mật khẩu');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  async updateProfile(userId: string, data: any) {
    const { fullName, phone, birthdate } = data;

    if (phone) {
      const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
      if (!phoneRegex.test(phone)) {
        throw new ConflictException('Số điện thoại không hợp lệ.');
      }

      const existingPhone = await this.prisma.user.findFirst({
        where: { phone, id: { not: userId } }
      });
      if (existingPhone) {
        throw new ConflictException('Số điện thoại này đã được sử dụng bởi một tài khoản khác.');
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Không tìm thấy người dùng');

    let updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;

    if (birthdate) {
      if (user.birthdate) {
        throw new ConflictException('Ngày sinh chỉ được cập nhật 1 lần duy nhất.');
      }
      updateData.birthdate = new Date(birthdate);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const { passwordHash, ...result } = updatedUser;
    return { message: 'Cập nhật thông tin thành công', user: result };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    // Delete old avatar file from frontend/public/avt if it was stored locally
    if (user.avatarUrl && user.avatarUrl.startsWith('/avt/')) {
      try {
        const oldFilename = user.avatarUrl.replace('/avt/', '');
        const oldFilePath = require('path').resolve(process.cwd(), '../frontend/public/avt', oldFilename);
        const fs = require('fs');
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (e) {
        console.warn('Could not remove old avatar:', e);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    const { passwordHash, ...result } = updatedUser;
    return {
      message: 'Cập nhật ảnh đại diện thành công',
      avatarUrl,
      user: result,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản với email này.');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let requestCount = user.resetPasswordRequestCount;
    let requestDate = user.resetPasswordRequestDate;

    if (!requestDate || requestDate.getTime() !== today.getTime()) {
      requestCount = 0;
      requestDate = today;
    }

    if (requestCount >= 3) {
      throw new ConflictException('Bạn đã yêu cầu gửi mã quên mật khẩu quá 3 lần trong ngày. Vui lòng thử lại vào ngày mai.');
    }

    if (user.resetPasswordLastSentAt) {
      const timeDiff = now.getTime() - user.resetPasswordLastSentAt.getTime();
      if (timeDiff < 60000) { // 1 minute
        throw new ConflictException('Vui lòng đợi 1 phút trước khi yêu cầu gửi lại mã.');
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5); // 5 minutes expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOtp: otp,
        resetPasswordExpires: expires,
        resetPasswordOtpAttempts: 0,
        resetPasswordLastSentAt: now,
        resetPasswordRequestCount: requestCount + 1,
        resetPasswordRequestDate: requestDate,
      }
    });

    // Send email using nodemailer
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
          from: `"Avora Restaurant" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Mã xác nhận quên mật khẩu',
          html: `<p>Xin chào ${user.fullName},</p>
                 <p>Mã xác nhận quên mật khẩu của bạn là: <strong>${otp}</strong></p>
                 <p>Mã này sẽ hết hạn trong vòng 5 phút.</p>`,
        });
      } else {
        // Fallback for development without SMTP credentials
        console.log(`\n\n=== OTP QUÊN MẬT KHẨU CỦA ${email} LÀ: ${otp} ===\n\n`);
      }
    } catch (e) {
      console.error('Error sending OTP email', e);
      // Fallback
      console.log(`\n\n=== OTP QUÊN MẬT KHẨU CỦA ${email} LÀ: ${otp} ===\n\n`);
    }

    return { message: 'Mã xác nhận đã được gửi đến email của bạn.' };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản.');
    }

    if (user.resetPasswordOtpAttempts >= 5) {
      throw new ConflictException('Bạn đã nhập sai mã xác nhận quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.');
    }

    if (!user.resetPasswordExpires || new Date() > user.resetPasswordExpires) {
      throw new UnauthorizedException('Mã xác nhận đã hết hạn.');
    }

    if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordOtpAttempts: user.resetPasswordOtpAttempts + 1 }
      });
      throw new UnauthorizedException('Mã xác nhận không chính xác.');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordOtp: null,
        resetPasswordExpires: null,
        resetPasswordOtpAttempts: 0,
      }
    });

    return { message: 'Khôi phục mật khẩu thành công.' };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản.');
    }

    if (user.resetPasswordOtpAttempts >= 5) {
      throw new ConflictException('Bạn đã nhập sai mã xác nhận quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.');
    }

    if (!user.resetPasswordExpires || new Date() > user.resetPasswordExpires) {
      throw new UnauthorizedException('Mã xác nhận đã hết hạn.');
    }

    if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordOtpAttempts: user.resetPasswordOtpAttempts + 1 }
      });
      throw new UnauthorizedException('Mã xác nhận không chính xác.');
    }

    return { message: 'Mã xác nhận hợp lệ.' };
  }

  async verifyAccount(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản.');
    }

    if (user.isEmailVerified) {
      throw new ConflictException('Tài khoản đã được xác thực.');
    }

    if (user.verificationOtpAttempts >= 5) {
      throw new ConflictException('Bạn đã nhập sai mã xác nhận quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.');
    }

    if (!user.verificationOtpExpires || new Date() > user.verificationOtpExpires) {
      throw new UnauthorizedException('Mã xác nhận đã hết hạn.');
    }

    if (!user.verificationOtp || user.verificationOtp !== otp) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { verificationOtpAttempts: user.verificationOtpAttempts + 1 }
      });
      throw new UnauthorizedException('Mã xác nhận không chính xác.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationOtp: null,
        verificationOtpExpires: null,
        verificationOtpAttempts: 0,
      }
    });

    await this.notificationService.createNotification({
      userId: user.id,
      title: 'Chào mừng bạn đến với Avora!',
      content: 'Tài khoản của bạn đã được đăng ký thành công. Hãy khám phá các món ăn tuyệt vời của chúng tôi nhé!',
      type: 'SYSTEM',
    });

    const payload = { sub: updatedUser.id, email: updatedUser.email, role: updatedUser.role, jti: crypto.randomUUID() };

    return {
      message: 'Xác thực tài khoản thành công',
      access_token: this.jwtService.sign(payload),
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
      }
    };
  }

  async resendVerificationOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản với email này.');
    }
    if (user.isEmailVerified) {
      throw new ConflictException('Tài khoản này đã được xác thực.');
    }

    const now = new Date();
    if (user.verificationOtpLastSentAt && (now.getTime() - user.verificationOtpLastSentAt.getTime() < 60000)) {
      throw new ConflictException('Vui lòng đợi 1 phút trước khi yêu cầu gửi lại mã.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationOtp: otp,
        verificationOtpExpires: expires,
        verificationOtpAttempts: 0,
        verificationOtpLastSentAt: now,
      }
    });

    this.sendVerificationEmail(email, user.fullName, otp);
    return { message: 'Mã xác nhận đã được gửi lại thành công.' };
  }

  async createDesktopLaunchCode(userId: string, ipAddress?: string): Promise<{ code: string; expiresIn: number }> {
    // 1. Kiểm tra tồn tại & trạng thái người dùng
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy thông tin tài khoản.');
    }

    if (user.isAccountLocked) {
      throw new ForbiddenException('Tài khoản của bạn đã bị khóa.');
    }

    // 2. Kiểm tra quyền POS Access
    const hasPosAccess =
      (await this.authorizationService.hasPermission(user.id, 'pos.access')) ||
      user.role === 'ADMIN';

    if (!hasPosAccess) {
      throw new ForbiddenException('Tài khoản của bạn không có quyền sử dụng AVORA POS Desktop.');
    }

    // 3. Kiểm tra phân quyền chi nhánh
    const effective = await this.authorizationService.getEffectivePermissions(user.id);
    const hasBranchAccess =
      effective.isAdmin ||
      (effective.permissions['pos.access']?.branchIds?.length > 0) ||
      !!user.branchId;

    if (!hasBranchAccess) {
      throw new ForbiddenException('Tài khoản chưa được phân quyền tại chi nhánh nào.');
    }

    // 4. Rate limit: tối đa 10 requests / phút / user
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentCount = await this.prisma.desktopLaunchCode.count({
      where: {
        userId: user.id,
        createdAt: { gte: oneMinuteAgo },
      },
    });

    if (recentCount >= 10) {
      throw new HttpException(
        'Bạn đã yêu cầu quá nhiều mã đăng nhập. Vui lòng đợi 1 phút và thử lại.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 5. Sinh mã ngẫu nhiên cryptographically random (64 hex characters)
    const code = crypto.randomBytes(32).toString('hex');
    const expiresIn = 60; // 60 seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 6. Lưu vào cơ sở dữ liệu
    await this.prisma.desktopLaunchCode.create({
      data: {
        code,
        userId: user.id,
        branchId: user.branchId,
        createdIp: ipAddress || null,
        expiresAt,
      },
    });

    // 7. Ghi Audit Log (Tuyệt đối KHÔNG log raw launch code hay token)
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'DESKTOP_LAUNCH_CODE_CREATED',
          target: 'Desktop Launch Code generated (expires in 60s)',
          ipAddress: ipAddress || null,
        },
      });
    } catch {
      // Non-fatal
    }

    return {
      code,
      expiresIn,
    };
  }

  async exchangeDesktopLaunchCode(
    code: string,
    deviceId?: string,
    appVersion?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; access_token: string; user: any }> {
    if (!code || typeof code !== 'string' || !code.trim()) {
      throw new BadRequestException('Mã xác thực không hợp lệ.');
    }

    const cleanCode = code.trim();

    // 1. Tìm bản ghi launch code
    const launchRecord = await this.prisma.desktopLaunchCode.findUnique({
      where: { code: cleanCode },
    });

    if (!launchRecord) {
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: '00000000-0000-0000-0000-000000000000',
            action: 'DESKTOP_LAUNCH_CODE_REJECTED',
            target: 'Launch code not found',
            ipAddress: ipAddress || null,
          },
        });
      } catch { }

      throw new UnauthorizedException({
        code: 'DESKTOP_SSO_CODE_INVALID',
        message: 'Mã xác thực không tồn tại hoặc không hợp lệ.',
      });
    }

    // 2. Kiểm tra đã sử dụng
    if (launchRecord.consumedAt) {
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: launchRecord.userId,
            action: 'DESKTOP_LAUNCH_CODE_REJECTED',
            target: 'Launch code already consumed',
            ipAddress: ipAddress || null,
          },
        });
      } catch { }

      throw new ConflictException({
        code: 'DESKTOP_SSO_CODE_ALREADY_USED',
        message: 'Mã xác thực này đã được sử dụng trước đó.',
      });
    }

    // 3. Kiểm tra hết hạn (quá 60s)
    if (launchRecord.expiresAt.getTime() < Date.now()) {
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: launchRecord.userId,
            action: 'DESKTOP_LAUNCH_CODE_EXPIRED',
            target: 'Launch code expired',
            ipAddress: ipAddress || null,
          },
        });
      } catch { }

      throw new UnauthorizedException({
        code: 'DESKTOP_SSO_CODE_EXPIRED',
        message: 'Liên kết đăng nhập đã hết hạn. Vui lòng thử mở lại AVORA POS từ trang web.',
      });
    }

    // 4. Atomic mark code consumed (Race condition protection across instances)
    const updateResult = await this.prisma.desktopLaunchCode.updateMany({
      where: {
        id: launchRecord.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        consumedAt: new Date(),
        consumedByIp: ipAddress || null,
        deviceId: deviceId || null,
        appVersion: appVersion || null,
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictException({
        code: 'DESKTOP_SSO_CODE_ALREADY_USED',
        message: 'Mã xác thực đã được sử dụng bởi một tiến trình khác.',
      });
    }

    // 5. Revalidate User tại thời điểm exchange
    const user = await this.prisma.user.findUnique({
      where: { id: launchRecord.userId },
    });

    if (!user || user.isAccountLocked) {
      throw new ForbiddenException('Tài khoản của bạn đã bị khóa hoặc không hợp lệ.');
    }

    // Revalidate POS Access
    const hasPosAccess =
      (await this.authorizationService.hasPermission(user.id, 'pos.access')) ||
      user.role === 'ADMIN';

    if (!hasPosAccess) {
      throw new ForbiddenException('Quyền truy cập AVORA POS của tài khoản đã bị thu hồi.');
    }

    // Revalidate Branch Access
    const effective = await this.authorizationService.getEffectivePermissions(user.id);
    const hasBranchAccess =
      effective.isAdmin ||
      (effective.permissions['pos.access']?.branchIds?.length > 0) ||
      !!user.branchId;

    if (!hasBranchAccess) {
      throw new ForbiddenException('Tài khoản chưa được phân quyền tại chi nhánh nào.');
    }

    // 6. Cấp Desktop Session
    const token = this.generateToken(user);

    // 7. Ghi Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'DESKTOP_LAUNCH_CODE_EXCHANGED',
          target: `Desktop Launch Code exchanged successfully (Device: ${deviceId || 'unknown'}, App: ${appVersion || 'unknown'})`,
          ipAddress: ipAddress || null,
        },
      });
    } catch { }

    return {
      success: true,
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        branchId: user.branchId,
      },
    };
  }
}

