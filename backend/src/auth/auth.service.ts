import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { NotificationService } from '../notification/notification.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
  ) {}

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

    // Tạo Payload cho JWT
    const payload = { sub: user.id, email: user.email, role: user.role };

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
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
        },
        membershipTier: true,
      }
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    const { passwordHash, ...result } = user;
    return { ...result, hasPassword: !!passwordHash };
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

    const payload = { sub: updatedUser.id, email: updatedUser.email, role: updatedUser.role };

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
}
