import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Ip,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BankConnectService } from './services/bank-connect.service';
import { OrderMatchingService } from './services/order-matching.service';
import { DeviceAuthGuard } from './guards/device-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PairDeviceDto } from './dto/pair-device.dto';
import { TransactionEventDto } from './dto/transaction-event.dto';
import {
  HeartbeatDto,
  RevokeDeviceDto,
  ManualMatchDto,
  CreateScanRequestDto,
  ScanReportDto,
  ConfirmRefundDto,
} from './dto/heartbeat.dto';

@Controller('bank-connect/v1')
export class BankConnectController {
  constructor(
    private readonly bankConnectService: BankConnectService,
    private readonly orderMatchingService: OrderMatchingService,
  ) {}

  /**
   * 1. Ghép nối thiết bị Android lần đầu tiên bằng pairing code
   * Public endpoint, yêu cầu có mã pairing hợp lệ do Admin cấp
   */
  @Post('pair')
  @HttpCode(HttpStatus.OK)
  async pairDevice(@Body() dto: PairDeviceDto, @Ip() clientIp: string) {
    return this.bankConnectService.pairDevice(dto, clientIp);
  }

  /**
   * 2. Tiếp nhận sự kiện biến động số dư Vietcombank từ Android
   * Được bảo vệ nghiêm ngặt bằng DeviceAuthGuard (Ký số ECDSA + Nonce + Timestamp)
   */
  @Post('events')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.OK)
  async receiveTransactionEvent(
    @Body() dto: TransactionEventDto,
    @Req() req: any,
    @Ip() clientIp: string,
  ) {
    const device = req.device;
    return this.bankConnectService.processTransactionEvent(dto, device, clientIp);
  }

  /**
   * 3. Heartbeat từ thiết bị Android giữ kết nối 24/7
   */
  @Post('heartbeat')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Body() dto: HeartbeatDto, @Ip() clientIp: string) {
    return this.bankConnectService.recordHeartbeat(dto, clientIp);
  }

  /**
   * 4. Kiểm tra trạng thái thiết bị
   */
  @Get('device/status')
  @UseGuards(DeviceAuthGuard)
  async getDeviceStatus(@Req() req: any) {
    return this.bankConnectService.getDeviceStatus(req.device.deviceId);
  }

  /**
   * 5. Thu hồi thiết bị từ chính Android app
   */
  @Post('device/revoke')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeSelfDevice(@Body() dto: RevokeDeviceDto, @Req() req: any) {
    return this.bankConnectService.revokeDevice(req.device.deviceId, dto.reason);
  }

  // ==========================================
  // ADMIN DASHBOARD MANAGEMENT ENDPOINTS
  // ==========================================

  /**
   * 6. Admin sinh mã pairing 5 phút một lần để liên kết điện thoại mới
   */
  @Post('admin/generate-pairing-code')
  @UseGuards(JwtAuthGuard)
  async generatePairingCode(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.bankConnectService.generatePairingCode(userId);
  }

  /**
   * 6.1. Admin kiểm tra trạng thái của mã pairing
   */
  @Get('admin/pairing-status')
  @UseGuards(JwtAuthGuard)
  async getPairingStatus(@Query('code') code: string) {
    return this.bankConnectService.getPairingStatus(code);
  }

  /**
   * 7. Admin xem danh sách thiết bị Android đã kết nối
   */
  @Get('admin/devices')
  @UseGuards(JwtAuthGuard)
  async listDevices() {
    return this.bankConnectService.listDevices();
  }

  /**
   * 8. Admin thu hồi thiết bị từ xa
   */
  @Post('admin/devices/:deviceId/revoke')
  @UseGuards(JwtAuthGuard)
  async adminRevokeDevice(
    @Param('deviceId') deviceId: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.bankConnectService.revokeDevice(deviceId, reason, userId);
  }

  /**
   * 9. Admin xem danh sách giao dịch ngân hàng & trạng thái đối soát
   */
  @Get('admin/transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('matchingStatus') matchingStatus?: string,
    @Query('direction') direction?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.bankConnectService.getTransactions({
      page,
      limit,
      matchingStatus,
      direction,
      fromDate,
      toDate,
    });
  }

  /**
   * 10. Admin đối soát thủ công khi giao dịch ở trạng thái REVIEW_REQUIRED
   */
  @Post('admin/transactions/:id/manual-match')
  @UseGuards(JwtAuthGuard)
  async manualMatch(
    @Param('id') id: string,
    @Body() dto: ManualMatchDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub || 'ADMIN';
    return this.orderMatchingService.manualMatch(id, dto.orderId, userId, dto.notes);
  }

  /**
   * 11. Xem chi tiết giao dịch ngân hàng kèm thông tin đối soát
   */
  @Get('admin/transactions/:id')
  @UseGuards(JwtAuthGuard)
  async getTransactionDetail(@Param('id') id: string) {
    return this.bankConnectService.getTransactionDetail(id);
  }

  /**
   * 12. Thử đối soát lại tự động một giao dịch cụ thể
   */
  @Post('admin/transactions/:id/re-match')
  @UseGuards(JwtAuthGuard)
  async reMatchTransaction(@Param('id') id: string) {
    return this.orderMatchingService.reMatchTransaction(id);
  }

  /**
   * 13. Xem chi tiết đơn hàng (hỗ trợ Android App / Admin Web)
   */
  @Get('admin/orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOrderDetail(@Param('id') id: string) {
    return this.bankConnectService.getOrderDetail(id);
  }

  private assertAdminRole(user: any) {
    if (!user) {
      throw new ForbiddenException('Yêu cầu xác thực Quản trị viên (Admin)');
    }
    const role = (user.role || '').toString().toUpperCase();
    if (role && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Chỉ tài khoản Quản trị viên (ADMIN) mới được phép thực hiện thao tác này');
    }
  }

  /**
   * 14. Dọn dẹp (archive an toàn) giao dịch không gắn với đơn hàng nào
   */
  @Delete('admin/transactions/:id')
  @UseGuards(JwtAuthGuard)
  async deleteUnmatchedTransaction(
    @Param('id') id: string,
    @Req() req: any,
    @Query('reason') reason?: string,
  ) {
    this.assertAdminRole(req?.user);
    const userId = req?.user?.id || req?.user?.sub || 'ADMIN';
    return this.bankConnectService.deleteUnmatchedTransaction(id, userId, reason);
  }

  /**
   * 14b. Dọn dẹp (archive an toàn) toàn bộ các giao dịch chưa khớp đủ điều kiện
   */
  @Delete('admin/transactions-unmatched/all')
  @UseGuards(JwtAuthGuard)
  async deleteAllUnmatchedTransactions(
    @Req() req: any,
    @Query('reason') reason?: string,
  ) {
    this.assertAdminRole(req?.user);
    const userId = req?.user?.id || req?.user?.sub || 'ADMIN';
    return this.bankConnectService.deleteAllUnmatchedTransactions(userId, reason);
  }

  @Post('admin/transactions-unmatched/cleanup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cleanupUnmatchedTransactionsPost(
    @Req() req: any,
    @Body('reason') reason?: string,
  ) {
    this.assertAdminRole(req?.user);
    const userId = req?.user?.id || req?.user?.sub || 'ADMIN';
    return this.bankConnectService.deleteAllUnmatchedTransactions(userId, reason);
  }

  /**
   * 15. Lấy danh sách chi nhánh
   */
  @Get('admin/branches')
  @UseGuards(JwtAuthGuard)
  async getBranches() {
    return this.bankConnectService.getBranches();
  }

  /**
   * 16. Lấy danh sách toàn bộ đơn hàng đã hoàn thành
   */
  @Get('admin/completed-orders')
  @UseGuards(JwtAuthGuard)
  async getCompletedOrders(
    @Query('branchId') branchId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.bankConnectService.getCompletedOrders({
      branchId,
      page,
      limit,
      search,
    });
  }

  // ==========================================
  // FEATURE 1: CASH SHIFT AUTO-AUDIT ENDPOINTS
  // ==========================================

  /**
   * 17. Quản lý xem danh sách ca làm việc gần đây để đối soát
   */
  @Get('admin/shifts/recent')
  @UseGuards(JwtAuthGuard)
  async getRecentShifts(
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.bankConnectService.getRecentShifts(branchId, limit);
  }

  /**
   * 18. Đối soát ca làm việc 1-chạm giữa POS và Ngân hàng
   */
  @Get('admin/shifts/:shiftId/audit')
  @UseGuards(JwtAuthGuard)
  async auditShift(@Param('shiftId') shiftId: string) {
    return this.bankConnectService.auditShift(shiftId);
  }

  // ==========================================
  // FEATURE 2: ANTI-FAKE BILL VERIFIER ENDPOINTS
  // ==========================================

  /**
   * 19. POS kích hoạt lệnh kiểm tra thanh toán khẩn cấp tới Gateway Android
   */
  @Post('admin/scan-request')
  @UseGuards(JwtAuthGuard)
  async createScanRequest(
    @Body() dto: CreateScanRequestDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.bankConnectService.createScanRequest(dto, userId);
  }

  /**
   * 20. Android Gateway báo cáo kết quả quét active notifications
   */
  @Post('scan-report')
  @UseGuards(DeviceAuthGuard)
  async reportScanResult(@Body() dto: ScanReportDto) {
    return this.bankConnectService.reportScanResult(dto);
  }

  /**
   * 21. POS thăm dò tiến độ & chẩn đoán sức khỏe Gateway
   */
  @Get('admin/scan-jobs/:scanJobId/status')
  @UseGuards(JwtAuthGuard)
  async getScanJobStatus(@Param('scanJobId') scanJobId: string) {
    return this.bankConnectService.getScanJobStatus(scanJobId);
  }

  // ==========================================
  // FEATURE 3: OVERPAID DUPLICATE & REFUNDS
  // ==========================================

  /**
   * 22. Danh sách các khoản khách hàng chuyển trùng cần hoàn tiền
   */
  @Get('admin/overpaid-duplicates')
  @UseGuards(JwtAuthGuard)
  async listOverpaidDuplicates(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.bankConnectService.listOverpaidDuplicates({ page, limit, status });
  }

  /**
   * 23. Tạo yêu cầu xử lý hoàn tiền
   */
  @Post('admin/overpaid-duplicates/:id/request-refund')
  @UseGuards(JwtAuthGuard)
  async requestOverpaidRefund(
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.bankConnectService.requestOverpaidRefund(id, notes);
  }

  /**
   * 24. Xác nhận đã hoàn tiền qua ngân hàng (Yêu cầu có mã tham chiếu chuyển khoản)
   */
  @Post('admin/overpaid-duplicates/:id/confirm-refund')
  @UseGuards(JwtAuthGuard)
  async confirmOverpaidRefund(
    @Param('id') id: string,
    @Body() dto: ConfirmRefundDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.bankConnectService.confirmOverpaidRefund(id, dto, userId);
  }

  // ==========================================
  // FEATURE 4: 1-TAP QUICK MATCH CANDIDATES
  // ==========================================

  /**
   * 25. Danh sách các đơn hàng ứng viên phù hợp để gán giao dịch thủ công trên Android
   */
  @Get('admin/pending-order-candidates')
  @UseGuards(JwtAuthGuard)
  async getPendingOrderCandidates(
    @Query('branchId') branchId?: string,
    @Query('amount') amount?: number,
    @Query('search') search?: string,
    @Query('transactionId') transactionId?: string,
  ) {
    return this.bankConnectService.getPendingOrderCandidates({
      branchId,
      amount,
      search,
      transactionId,
    });
  }

  // ==========================================
  // OTA IN-APP AUTO-UPDATE ENDPOINTS
  // ==========================================

  /**
   * 26. Tải trực tiếp file APK bản cập nhật mới nhất cho Android (Một nguồn phát hành chuẩn duy nhất)
   */
  @Get('app/download-latest')
  async downloadLatestApk(@Res() res: any) {
    const foundPath = this.bankConnectService.resolveCanonicalApkPath();

    if (!foundPath) {
      throw new NotFoundException('Chưa tìm thấy file APK cập nhật trên máy chủ');
    }

    const meta = this.bankConnectService.getLatestApkMetadata();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('X-Apk-Package-Name', meta.packageName);
    res.setHeader('X-Apk-Version-Name', meta.versionName);
    res.setHeader('X-Apk-Version-Code', String(meta.versionCode));
    res.setHeader('X-Apk-Sha256', meta.sha256);

    return res.download(foundPath, 'avora-bank-connect.apk');
  }

  /**
   * 27. Kiểm tra phiên bản mới nhất của ứng dụng Android kèm SHA-256 & kích thước thực tế
   */
  @Get('app/version')
  getAppVersion(@Res({ passthrough: true }) res: any) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    return {
      success: true,
      data: this.bankConnectService.getLatestApkMetadata(),
    };
  }

  /**
   * 28. Admin bắn lệnh cập nhật OTA xuống thiết bị Gateway từ xa
   */
  @Post('admin/devices/push-update')
  @UseGuards(JwtAuthGuard)
  async pushOtaUpdate(@Body('deviceId') deviceId?: string) {
    return this.bankConnectService.pushOtaUpdate(deviceId);
  }
}

