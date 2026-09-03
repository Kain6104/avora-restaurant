import { Controller, Post, Body, HttpCode, HttpStatus, Res, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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

    return { message: 'Đăng nhập thành công' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', { path: '/' });
    return { message: 'Đăng xuất thành công' };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {
    // Initiates the Google OAuth2 login flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request & { user: any }, @Res() res: Response) {
    // This will be called after successful Google authentication
    // The user is injected into req.user by the GoogleStrategy
    const token = this.authService.generateToken(req.user);

    // Set HTTP-Only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS in production
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect back to frontend with loginSuccess flag
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?loginSuccess=true`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: any }) {
    return this.authService.getMe(req.user.id);
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
