import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BuffetService } from './buffet.service';
import { CreateBuffetPackageDto } from './dto/create-buffet-package.dto';
import { UpdateBuffetPackageDto } from './dto/update-buffet-package.dto';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('buffet')
@UseGuards(OptionalJwtAuthGuard)
export class BuffetController {
  constructor(private readonly buffetService: BuffetService) {}

  @Get('packages')
  async getPackages(
    @Query('branchId') branchId: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    const data = await this.buffetService.findByBranch(branchId, onlyActive === 'true');
    return { success: true, data };
  }

  @Get('packages/:id')
  async getPackageById(@Param('id') id: string) {
    const data = await this.buffetService.findById(id);
    return { success: true, data };
  }

  @Post('packages')
  async createPackage(@Body() dto: CreateBuffetPackageDto, @Req() req?: any) {
    const data = await this.buffetService.createPackage(dto, req?.user);
    return { success: true, data, message: 'Đã tạo gói Buffet thành công' };
  }

  @Put('packages/:id')
  async updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdateBuffetPackageDto,
    @Req() req?: any,
  ) {
    const data = await this.buffetService.updatePackage(id, dto, req?.user);
    return { success: true, data, message: 'Đã cập nhật gói Buffet thành công' };
  }

  @Delete('packages/:id')
  async deletePackage(@Param('id') id: string, @Req() req?: any) {
    const data = await this.buffetService.deletePackage(id, req?.user);
    return { success: true, data, message: 'Đã xóa gói Buffet thành công' };
  }

  @Get('orders/:orderId/session')
  async getActiveSession(@Param('orderId') orderId: string) {
    const data = await this.buffetService.getActiveBuffetSession(orderId);
    return { success: true, data };
  }
}
