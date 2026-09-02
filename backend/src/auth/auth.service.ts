import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
  ) {}

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

    // Tạo user mới
    const newUser = await this.prisma.user.create({
      data: {
        email,
        fullName,
        phone,
        passwordHash,
        role: 'USER',
      },
    });

    // Tạo thông báo chào mừng
    await this.notificationService.createNotification({
      userId: newUser.id,
      title: 'Chào mừng bạn đến với Avora!',
      content: 'Tài khoản của bạn đã được đăng ký thành công. Hãy khám phá các món ăn tuyệt vời của chúng tôi nhé!',
      type: 'SYSTEM',
    });

    return {
      message: 'Đăng ký thành công',
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
      }
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
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          fullName,
          avatarUrl: picture,
          googleId,
          authProvider: 'GOOGLE',
          role: 'USER',
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
        branch: { select: { id: true, name: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    const { passwordHash, ...result } = user;
    
    // Thêm permissions dựa trên role
    const permissions = require('../common/constants/permissions').ROLE_PERMISSIONS[user.role] || [];
    
    return { ...result, hasPassword: !!passwordHash, permissions };
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
}
