import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { FarmAssetService, UpdateAssetConfigDto, UploadAssetDto, ApplyDefaultScaleDto } from './farm-asset.service';

@Controller('admin/farm/assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminFarmAssetController {
  constructor(private readonly farmAssetService: FarmAssetService) {}

  @Get()
  @RequirePermission('farm.view')
  async getGroupedAssets() {
    const data = await this.farmAssetService.getGroupedAssets();
    return { success: true, data };
  }

  @Post('apply-default-scale')
  @RequirePermission('farm.manage_crop')
  async applyDefaultScale(
    @Body() dto: ApplyDefaultScaleDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const data = await this.farmAssetService.applyDefaultScale(dto, userId);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermission('farm.manage_crop')
  async updateAssetConfig(
    @Param('id') id: string,
    @Body() dto: UpdateAssetConfigDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const data = await this.farmAssetService.updateAssetConfig(id, dto, userId);
    return { success: true, data };
  }

  @Post('upload')
  @RequirePermission('farm.manage_crop')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.match(/\.(png|webp|avif)$/i) && !file.mimetype.match(/image\/(png|webp|avif)/i)) {
          return callback(new BadRequestException('Chỉ chấp nhận file định dạng PNG, WebP hoặc AVIF!'), false);
        }
        callback(null, true);
      },
    }),
  )
  async uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAssetDto,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh để tải lên');
    }
    const userId = req.user?.id;
    const data = await this.farmAssetService.handleAssetUpload(file, dto, userId);
    return { success: true, data };
  }
}
