import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    role?: RoleType;
    branchIdScope?: string;
  }) {
    const { skip = 0, take = 10, search, role, branchIdScope } = params;

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (branchIdScope) {
      where.branchId = branchIdScope;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          branchId: true,
          branch: {
            select: { name: true },
          },
          isEmailVerified: true,
          isAccountLocked: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Math.floor(skip / take) + 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findOne(id: string, branchIdScope?: string) {
    const where: any = { id };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }
    const user = await this.prisma.user.findFirst({
      where,
      include: {
        branch: { select: { name: true, id: true } },
        membershipTier: true,
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            branch: { select: { name: true } },
            orderItems: {
              include: { product: { select: { name: true, imageUrl: true } } },
            },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found or access denied');
    }

    // Never return sensitive security fields
    const {
      passwordHash,
      verificationOtp,
      resetPasswordOtp,
      changeEmailOtp,
      ...safeUser
    } = user as any;

    return safeUser;
  }

  async updateUserRole(id: string, role: RoleType, branchId: string | null, adminId?: string) {
    if ((role === RoleType.MANAGER || role === RoleType.CHEF) && !branchId) {
      throw new BadRequestException(`Branch ID is required for role ${role}`);
    }

    const oldUser = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, branchId: true, fullName: true },
    });

    if (!oldUser) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        role,
        branchId: branchId || null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
      },
    });

    if (adminId && oldUser) {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'UPDATE_ROLE',
          target: `User: ${oldUser.fullName} (${id})`,
          oldValue: `Role: ${oldUser.role}, Branch: ${oldUser.branchId}`,
          newValue: `Role: ${role}, Branch: ${branchId}`,
        },
      });
    }

    return user;
  }

  async create(data: any) {
    // Tự sinh mật khẩu ngẫu nhiên nếu không truyền (khách hàng sẽ dùng quên mật khẩu để đặt)
    const initialPassword = Math.random().toString(36).slice(-8) + 'A1@';
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const email = data.email ? data.email.trim().toLowerCase() : null;
    if (!email) {
      throw new BadRequestException('Email là bắt buộc');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng bởi tài khoản khác');
    }

    delete data.password;
    delete data.passwordHash;
    delete data.isEmailVerified;

    return this.prisma.user.create({
      data: {
        ...data,
        email,
        passwordHash,
        isEmailVerified: false,
      },
    });
  }

  async update(id: string, data: any, adminId?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // BẢO MẬT 1: Tuyệt đối không cho phép Admin xem/nhập/đổi mật khẩu khách hàng
    delete data.password;
    delete data.passwordHash;

    // BẢO MẬT 2: Tuyệt đối không cho phép Admin tự ý gán cờ isEmailVerified thủ công
    delete data.isEmailVerified;

    // BẢO MẬT 3: Nếu user đã xác thực email, cấm sửa email trực tiếp
    if (data.email) {
      const cleanEmail = data.email.trim().toLowerCase();
      if (cleanEmail !== existingUser.email.toLowerCase()) {
        if (existingUser.isEmailVerified) {
          throw new BadRequestException(
            'Email đã được xác thực không thể chỉnh sửa trực tiếp. Vui lòng sử dụng quy trình Đổi Email qua OTP.'
          );
        } else {
          // Nếu email chưa xác thực, cho phép sửa nhưng phải kiểm tra trùng lặp
          const duplicate = await this.prisma.user.findFirst({
            where: { email: cleanEmail, id: { not: id } },
          });
          if (duplicate) {
            throw new BadRequestException('Email này đã được sử dụng bởi một tài khoản khác');
          }
          data.email = cleanEmail;
        }
      } else {
        delete data.email;
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
    });

    if (adminId) {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'UPDATE_USER_PROFILE',
          target: `User: ${existingUser.fullName} (${id})`,
          oldValue: JSON.stringify({ fullName: existingUser.fullName, phone: existingUser.phone, isAccountLocked: existingUser.isAccountLocked }),
          newValue: JSON.stringify({ fullName: updatedUser.fullName, phone: updatedUser.phone, isAccountLocked: updatedUser.isAccountLocked }),
        },
      });
    }

    return updatedUser;
  }

  /**
   * Bước 1: Yêu cầu đổi sang email mới và gửi mã OTP
   */
  async requestEmailChange(userId: string, newEmail: string, adminId?: string) {
    if (!newEmail || typeof newEmail !== 'string') {
      throw new BadRequestException('Email mới là bắt buộc');
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new BadRequestException('Định dạng email không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (user.email.toLowerCase() === cleanEmail) {
      throw new BadRequestException('Email mới phải khác với email hiện tại của người dùng');
    }

    // Kiểm tra xem email mới đã tồn tại trên hệ thống chưa
    const existing = await this.prisma.user.findFirst({
      where: { email: cleanEmail, id: { not: userId } },
    });
    if (existing) {
      throw new BadRequestException('Email này đã được sử dụng bởi một tài khoản khác');
    }

    // Rate limit: Không gửi lại quá nhanh trong vòng 60 giây
    const now = new Date();
    if (user.changeEmailOtpLastSentAt) {
      const diffMs = now.getTime() - user.changeEmailOtpLastSentAt.getTime();
      if (diffMs < 60000) {
        const waitSec = Math.ceil((60000 - diffMs) / 1000);
        throw new BadRequestException(`Vui lòng đợi ${waitSec} giây trước khi yêu cầu gửi lại mã OTP`);
      }
    }

    // Sinh mã OTP 6 số ngẫu nhiên & thời hạn 10 phút
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingNewEmail: cleanEmail,
        changeEmailOtp: otp,
        changeEmailOtpExpires: expires,
        changeEmailOtpAttempts: 0,
        changeEmailOtpLastSentAt: now,
      },
    });

    // Gửi email chứa OTP đến chính email mới
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
          from: `"Avora Restaurant Security" <${process.env.SMTP_USER}>`,
          to: cleanEmail,
          subject: `Mã xác thực đổi địa chỉ email tài khoản - Avora Restaurant`,
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                   <div style="background-color: #dc2626; padding: 24px; text-align: center;">
                     <h2 style="color: white; margin: 0; font-size: 20px;">XÁC THỰC THAY ĐỔI EMAIL TÀI KHOẢN</h2>
                   </div>
                   <div style="padding: 24px;">
                     <p>Xin chào <strong>${user.fullName || 'Quý khách'}</strong>,</p>
                     <p>Hệ thống quản trị <strong>Avora Restaurant</strong> vừa nhận được yêu cầu cập nhật địa chỉ email tài khoản của bạn sang: <strong>${cleanEmail}</strong>.</p>
                     <p>Vui lòng sử dụng mã xác thực (OTP) dưới đây để hoàn tất quy trình:</p>
                     
                     <div style="text-align: center; margin: 28px 0;">
                       <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #dc2626; background-color: #fef2f2; padding: 14px 28px; border-radius: 10px; border: 1px dashed #f87171; display: inline-block;">${otp}</span>
                     </div>

                     <p style="color: #64748b; font-size: 13px;">Mã xác nhận có hiệu lực trong vòng <strong>10 phút</strong>. Nếu bạn không thực hiện hoặc không yêu cầu thay đổi này, vui lòng bỏ qua email hoặc liên hệ ngay bộ phận hỗ trợ của chúng tôi.</p>
                   </div>
                   <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                     <p style="margin: 0;">Trân trọng, Đội ngũ Bảo mật Avora Restaurant</p>
                   </div>
                 </div>`,
        });
      }
      console.log(`\n\n=== [SECURITY] OTP ĐỔI EMAIL CHO USER (${user.id}) SANG ${cleanEmail} LÀ: ${otp} ===\n\n`);
    } catch (e) {
      console.error('Error sending change email OTP', e);
      console.log(`\n\n=== [SECURITY] OTP ĐỔI EMAIL CHO USER (${user.id}) SANG ${cleanEmail} LÀ: ${otp} ===\n\n`);
    }

    return {
      success: true,
      message: `Mã xác thực OTP đã được gửi đến email ${cleanEmail}. Vui lòng kiểm tra hộp thư.`,
    };
  }

  /**
   * Bước 2: Xác thực mã OTP và cập nhật Email mới cho User
   */
  async verifyEmailChange(userId: string, newEmail: string, otp: string, adminId?: string) {
    if (!newEmail || !otp) {
      throw new BadRequestException('Email mới và mã OTP là bắt buộc');
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!user.pendingNewEmail || user.pendingNewEmail.toLowerCase() !== cleanEmail) {
      throw new BadRequestException('Không tìm thấy yêu cầu đổi email đang chờ hoặc email không khớp');
    }

    if (user.changeEmailOtpAttempts >= 5) {
      throw new BadRequestException('Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã OTP mới.');
    }

    if (!user.changeEmailOtpExpires || new Date() > user.changeEmailOtpExpires) {
      throw new BadRequestException('Mã OTP đã hết hạn (hiệu lực trong 10 phút). Vui lòng gửi lại mã mới.');
    }

    if (!user.changeEmailOtp || user.changeEmailOtp !== cleanOtp) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { changeEmailOtpAttempts: user.changeEmailOtpAttempts + 1 },
      });
      const remaining = 4 - user.changeEmailOtpAttempts;
      throw new BadRequestException(`Mã OTP không chính xác. Bạn còn ${remaining > 0 ? remaining : 0} lần thử.`);
    }

    // Re-check trùng lặp lần cuối trước khi commit
    const duplicate = await this.prisma.user.findFirst({
      where: { email: cleanEmail, id: { not: userId } },
    });
    if (duplicate) {
      throw new BadRequestException('Email này đã được đăng ký bởi một tài khoản khác trong thời gian chờ.');
    }

    const oldEmail = user.email;

    // Cập nhật email mới, đánh dấu verified, và xóa OTP tạm
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: cleanEmail,
        isEmailVerified: true,
        pendingNewEmail: null,
        changeEmailOtp: null,
        changeEmailOtpExpires: null,
        changeEmailOtpAttempts: 0,
      },
    });

    // Ghi Audit Log bắt buộc
    if (adminId) {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'CHANGE_USER_EMAIL',
          target: `User: ${user.fullName} (${user.id})`,
          oldValue: `Email cũ: ${oldEmail}`,
          newValue: `Email mới: ${cleanEmail} (Đã xác minh OTP thành công)`,
        },
      });
    }

    return {
      success: true,
      message: 'Cập nhật và xác thực email mới thành công!',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        isEmailVerified: updatedUser.isEmailVerified,
      },
    };
  }
}
