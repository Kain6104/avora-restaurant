import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Get,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleOAuthGuard } from './google-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

interface DesktopAuthEntry {
  token: string;
  user: any;
  expiresAt: number;
}

const desktopAuthCodes = new Map<string, DesktopAuthEntry>();

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.resolve(process.cwd(), '../frontend/public/avt');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req: any, file, cb) => {
          const userId = req.user?.id || 'user';
          const ext = path.extname(file.originalname).toLowerCase();
          const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
          const filename = `avt-${userId}-${Date.now()}${safeExt}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          return cb(
            new BadRequestException('Chỉ chấp nhận các định dạng file ảnh (jpg, jpeg, png, gif, webp)!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadAvatar(@Req() req: Request & { user: any }, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh để tải lên');
    }
    const avatarUrl = `/avt/${file.filename}`;
    return this.authService.updateAvatar(req.user.id, avatarUrl);
  }

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const data = await this.authService.login(body);

    // Set HTTP-Only Cookie
    res.cookie('token', data.access_token, {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS in production
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      message: 'Đăng nhập thành công',
      access_token: data.access_token,
      token: data.access_token,
      user: data.user,
    };
  }

  @Post('desktop/login')
  @HttpCode(HttpStatus.OK)
  async desktopLogin(@Body() body: any) {
    const data = await this.authService.login(body);
    return {
      success: true,
      message: 'Đăng nhập thành công',
      access_token: data.access_token,
      user: data.user,
    };
  }

  @Post('desktop/launch-code')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createDesktopLaunchCode(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Phiên làm việc không hợp lệ');
    }
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    return this.authService.createDesktopLaunchCode(userId, clientIp);
  }

  @Post('desktop/exchange-launch-code')
  @HttpCode(HttpStatus.OK)
  async exchangeDesktopLaunchCode(
    @Body() body: { code: string; deviceId?: string; appVersion?: string },
    @Req() req: any,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    return this.authService.exchangeDesktopLaunchCode(body?.code, body?.deviceId, body?.appVersion, clientIp);
  }

  @Post('desktop/exchange-code')
  @HttpCode(HttpStatus.OK)
  async exchangeDesktopCode(
    @Body('code') code: string,
    @Body('deviceId') deviceId?: string,
    @Body('appVersion') appVersion?: string,
    @Req() req?: any,
  ) {
    if (!code) {
      throw new BadRequestException('Mã xác thực không được để trống');
    }

    const entry = desktopAuthCodes.get(code);
    if (entry) {
      desktopAuthCodes.delete(code);
      if (Date.now() > entry.expiresAt) {
        throw new UnauthorizedException('Mã xác thực đã hết hạn. Vui lòng thử lại');
      }
      return {
        success: true,
        access_token: entry.token,
        user: entry.user,
      };
    }

    // Fallback to database launch code exchange
    const clientIp = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req?.ip;
    return this.authService.exchangeDesktopLaunchCode(code, deviceId, appVersion, clientIp);
  }

  @Post('desktop/create-test-code')
  @HttpCode(HttpStatus.OK)
  async createTestCode(@Body('email') email: string) {
    let user: any = null;
    if (email) {
      user = await (this.authService as any).prisma.user.findFirst({
        where: { email },
      });
    }
    if (!user) {
      user = {
        id: '701928f5-bced-4a68-b498-2eeb44b28ba1',
        email: email || 'admin@avora.vn',
        fullName: 'Quản trị viên',
        role: 'ADMIN',
      };
    }
    const token = this.authService.generateToken(user);
    const code = randomUUID();
    desktopAuthCodes.set(code, {
      token,
      user,
      expiresAt: Date.now() + 120000,
    });
    return { success: true, code };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', { path: '/' });
    return { message: 'Đăng xuất thành công' };
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(@Req() req: Request) {
    // Initiates the Google OAuth2 login flow with state preservation
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request & { user: any }, @Res() res: Response) {
    // This will be called after successful Google authentication
    const token = this.authService.generateToken(req.user);

    // Set HTTP-Only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS in production
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Extract target redirect and desktop flag from OAuth state if present
    let targetRedirect = '/';
    let isDesktop = false;
    if (req.query?.state && typeof req.query.state === 'string') {
      try {
        const stateStr = Buffer.from(req.query.state, 'base64').toString('utf8');
        const parsed = JSON.parse(stateStr);
        if (parsed.redirectURL && typeof parsed.redirectURL === 'string') {
          targetRedirect = parsed.redirectURL;
        }
        if (parsed.isDesktop) {
          isDesktop = true;
        }
      } catch (err) {
        // Fallback to default
      }
    }

    // Desktop OAuth flow: one-time authorization code exchange
    const isNativeDesktop = targetRedirect.startsWith('avora-pos-native://');
    if (isDesktop || targetRedirect.startsWith('avora-pos://') || isNativeDesktop) {
      const code = randomUUID();
      desktopAuthCodes.set(code, {
        token,
        user: {
          id: req.user.id,
          email: req.user.email,
          fullName: req.user.fullName,
          role: req.user.role,
        },
        expiresAt: Date.now() + 120000,
      });

      const desktopCallbackUri = isNativeDesktop
        ? `avora-pos-native://auth/callback?code=${encodeURIComponent(code)}`
        : `avora-pos://auth/callback?code=${encodeURIComponent(code)}`;
      const appDisplayName = isNativeDesktop ? 'AVORA POS Native' : 'AVORA POS Desktop';
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="utf-8">
          <title>${appDisplayName} Authentication</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              margin: 0; padding: 0;
              background-color: #0B1120;
              color: #F8FAFC;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              display: flex; align-items: center; justify-content: center; height: 100vh;
            }
            .card {
              background: #1E293B;
              border: 1px solid #334155;
              border-radius: 16px;
              padding: 40px;
              max-width: 440px;
              text-align: center;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            }
            .title { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
            .subtitle { font-size: 14px; color: #94A3B8; margin-bottom: 24px; line-height: 1.5; }
            .btn {
              display: inline-block;
              background-color: #DA251D;
              color: #ffffff;
              font-weight: 600;
              text-decoration: none;
              padding: 12px 28px;
              border-radius: 8px;
              font-size: 14px;
              transition: background-color 0.2s;
            }
            .btn:hover { background-color: #B91C1C; }
            .spinner {
              width: 36px; height: 36px; border: 3px solid #334155;
              border-top-color: #DA251D; border-radius: 50%;
              animation: spin 1s linear infinite; margin: 0 auto 20px auto;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="spinner"></div>
            <div class="title">Đăng Nhập Thành Công!</div>
            <div class="subtitle">Đang chuyển tiếp về ứng dụng <strong>${appDisplayName}</strong>.<br>Bạn có thể đóng tab này sau khi vào ứng dụng.</div>
            <a href="${desktopCallbackUri}" class="btn">Mở ${appDisplayName}</a>
          </div>
          <script>
            window.location.href = "${desktopCallbackUri}";
            setTimeout(function() {
              window.close();
            }, 3500);
          </script>
        </body>
        </html>
      `);
    }

    // Redirect back to frontend with loginSuccess flag
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const cleanPath = targetRedirect.startsWith('/') ? targetRedirect : `/${targetRedirect}`;
    const separator = cleanPath.includes('?') ? '&' : '?';
    res.redirect(`${frontendUrl}${cleanPath}${separator}loginSuccess=true`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: any }) {
    return this.authService.getMe(req.user.id);
  }

  @Get('me/capabilities')
  @UseGuards(JwtAuthGuard)
  async meCapabilities(@Req() req: Request & { user: any }) {
    return this.authService.getCapabilities(req.user.id);
  }

  @Put('update-phone')
  @UseGuards(JwtAuthGuard)
  async updatePhone(@Req() req: Request & { user: any }, @Body('phone') phone: string) {
    await this.authService.updatePhone(req.user.id, phone);
    return { message: 'Cập nhật số điện thoại thành công' };
  }

  @Post('add-password')
  @UseGuards(JwtAuthGuard)
  async addPassword(@Req() req: Request & { user: any }, @Body('password') password: string) {
    return this.authService.addPassword(req.user.id, password);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req: Request & { user: any }, @Body() body: any) {
    return this.authService.changePassword(req.user.id, body);
  }

  @Put('update-profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: Request & { user: any }, @Body() body: any) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: any) {
    return this.authService.resetPassword(body.email, body.otp, body.newPassword);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: any) {
    return this.authService.verifyOtp(body.email, body.otp);
  }

  @Post('verify-account')
  @HttpCode(HttpStatus.OK)
  async verifyAccount(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const data = await this.authService.verifyAccount(body.email, body.otp);

    // Set HTTP-Only Cookie to log them in automatically
    res.cookie('token', data.access_token, {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS in production
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { message: data.message, user: data.user };
  }

  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationOtp(email);
  }
}
