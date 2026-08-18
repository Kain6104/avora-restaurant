import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    const { passwordHash, ...result } = user;
    return result;
  }
}
