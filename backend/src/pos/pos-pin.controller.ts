import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PosPinService } from './pos-pin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('pos')
export class PosPinController {
  constructor(private readonly pinService: PosPinService) {}

  /**
   * Thiết lập kết nối tin cậy cho máy trạm AVORA POS Desktop (Trusted Terminal).
   */
  @Post('device/handshake')
  @HttpCode(HttpStatus.OK)
  async handshakeDevice(
    @Body() body: { deviceId: string; machineName?: string },
  ) {
    return this.pinService.handshakeDevice(body);
  }

  /**
   * Đăng nhập nhanh bằng mã PIN 4 số trên AVORA POS Desktop.
   * Yêu cầu headers X-Pos-Device-Id và X-Pos-Device-Secret.
   */
  @Post('auth/pin/login')
  @HttpCode(HttpStatus.OK)
  async loginWithPin(
    @Body('pin') pin: string,
    @Headers('x-pos-device-id') deviceId: string,
    @Headers('x-pos-device-secret') deviceSecret: string,
    @Req() req: any,
  ) {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    return this.pinService.loginWithPin(pin, deviceId, deviceSecret, clientIp);
  }

  /**
   * Yêu cầu gửi mã OTP 6 số về Email của người dùng để xác thực thao tác PIN.
   */
  @Post('auth/pin/request-otp')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async requestPinOtp(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.pinService.sendPinOtp(userId);
  }

  /**
   * Lấy trạng thái mã PIN của tài khoản nhân viên đang đăng nhập.
   */
  @Get('auth/pin/status')
  @UseGuards(JwtAuthGuard)
  async getPinStatus(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.pinService.getPinStatus(userId);
  }

  /**
   * Thiết lập mã PIN mới cho tài khoản (Xác thực bằng Mật khẩu HOẶC OTP).
   */
  @Post('auth/pin/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setupPin(
    @Body() body: { password?: string; otp?: string; pin: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    return this.pinService.setupPin(userId, body, clientIp);
  }

  /**
   * Đổi mã PIN hiện tại sang mã PIN mới (Xác thực bằng Mật khẩu HOẶC OTP).
   */
  @Put('auth/pin/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePin(
    @Body() body: { password?: string; otp?: string; newPin: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    return this.pinService.changePin(userId, body, clientIp);
  }

  /**
   * Xóa mã PIN của tài khoản (Xác thực bằng Mật khẩu HOẶC OTP).
   */
  @Delete('auth/pin')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removePin(
    @Body() body: { password?: string; otp?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    return this.pinService.removePin(userId, body, clientIp);
  }
}

