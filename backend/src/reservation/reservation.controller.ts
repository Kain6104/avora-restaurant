import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  UpdateReservationCustomerDto,
  CancelReservationDto,
} from './dto/update-reservation.dto';
import {
  AvailabilityQueryDto,
  GuestLookupDto,
  CheckInTokenDto,
} from './dto/availability-query.dto';

@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  /**
   * Danh sách chi nhánh nhận đặt bàn (Public API)
   */
  @Get('branches')
  async getBranches() {
    const data = await this.reservationService.getBranches();
    return {
      success: true,
      data,
    };
  }

  /**
   * Kiểm tra khung giờ còn chỗ (Public API)
   */
  @Get('availability')
  async getAvailability(@Query() query: AvailabilityQueryDto) {
    const data = await this.reservationService.getAvailability(query);
    return {
      success: true,
      data,
    };
  }

  /**
   * Đặt bàn mới (Hỗ trợ cả Khách vãng lai và Thành viên đăng nhập)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async createReservation(@Request() req, @Body() dto: CreateReservationDto) {
    // Check if token was provided in header
    const userId = req.user?.id;
    const actorRole = req.user?.role || 'USER';

    const data = await this.reservationService.createReservation(dto, userId, actorRole);
    return {
      success: true,
      message: 'Đặt bàn thành công',
      data,
    };
  }

  /**
   * Tra cứu đặt bàn cho khách vãng lai (Guest Lookup - Bắt buộc mã đặt bàn + SĐT, không lộ PII)
   */
  @Post('guest-lookup')
  @HttpCode(HttpStatus.OK)
  async guestLookup(@Body() dto: GuestLookupDto) {
    const data = await this.reservationService.getReservationByCode(
      dto.reservationCode,
      dto.phone,
    );
    return {
      success: true,
      data,
    };
  }

  /**
   * Lấy danh sách đặt bàn của tôi (Customer profile)
   */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyReservations(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const data = await this.reservationService.getCustomerReservations(req.user.id, pageNum, limitNum);
    return {
      success: true,
      data,
    };
  }

  /**
   * Chi tiết đặt bàn của tôi (Hỗ trợ cả thành viên đăng nhập và khách có số điện thoại)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('my/:code')
  async getMyReservationDetail(
    @Request() req,
    @Param('code') code: string,
    @Query('phone') phone?: string,
  ) {
    const userId = req.user?.id;
    const data = await this.reservationService.getReservationByCode(
      code,
      phone,
      userId,
      false,
    );
    return {
      success: true,
      data,
    };
  }

  /**
   * Khách hàng tự hủy đặt bàn (Customer cancellation)
   */
  @Put(':id/cancel')
  async cancelReservation(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CancelReservationDto & { phone?: string },
  ) {
    const userId = req.user?.id;
    const data = await this.reservationService.customerCancelReservation(
      id,
      userId,
      dto.phone,
      dto.cancelReason,
    );
    return {
      success: true,
      message: 'Đã hủy đặt bàn thành công',
      data,
    };
  }

  /**
   * Quét và xác thực mã QR check-in token (Staff / Scanner)
   */
  @Post('verify-checkin')
  @HttpCode(HttpStatus.OK)
  async verifyCheckIn(@Body() dto: CheckInTokenDto) {
    const data = await this.reservationService.verifyCheckInToken(dto.token);
    return {
      success: true,
      message: 'Mã check-in hợp lệ',
      data,
    };
  }
}
