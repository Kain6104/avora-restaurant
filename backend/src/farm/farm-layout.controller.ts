import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Ip,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { FarmLayoutService } from './farm-layout.service';
import { FarmGardenAssetService } from './farm-garden-asset.service';
import {
  SaveDraftLayoutDto,
  PublishLayoutDto,
  RollbackLayoutDto,
  CreateLayoutDto,
  UploadGardenAssetDto,
  UpdateGardenAssetDto,
} from './dto/farm-layout.dto';

// ==============================================================
// 1. ADMIN GARDEN LAYOUT CONTROLLER
// ==============================================================
@Controller('admin/farm/garden-layout')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminFarmLayoutController {
  constructor(
    private readonly farmLayoutService: FarmLayoutService,
  ) {}

  @Get()
  @RequirePermission('farm.view')
  async getLayoutList() {
    const data = await this.farmLayoutService.getLayoutList();
    return { success: true, data };
  }

  @Get('active')
  @RequirePermission('farm.view')
  async getActiveLayout() {
    const data = await this.farmLayoutService.getActivePublishedLayout();
    return { success: true, data };
  }

  @Get('version/:id')
  @RequirePermission('farm.view')
  async getLayoutVersion(@Param('id') id: string) {
    const data = await this.farmLayoutService.getLayoutVersion(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('farm.manage_crop')
  async createLayout(@Body() dto: CreateLayoutDto, @Request() req: any) {
    const userId = req.user?.id;
    const data = await this.farmLayoutService.createLayout(dto, userId);
    return { success: true, data };
  }

  @Post('version/:id/duplicate')
  @RequirePermission('farm.manage_crop')
  async duplicateVersion(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    const data = await this.farmLayoutService.duplicateVersion(id, userId);
    return { success: true, data };
  }

  @Put('version/:id/draft')
  @RequirePermission('farm.manage_crop')
  async saveDraft(
    @Param('id') id: string,
    @Body() dto: SaveDraftLayoutDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    const userId = req.user?.id;
    const data = await this.farmLayoutService.saveDraft(id, dto, userId, ip);
    return { success: true, data };
  }

  @Post('version/:id/publish')
  @RequirePermission('farm.manage_crop')
  async publish(
    @Param('id') id: string,
    @Body() dto: PublishLayoutDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    const userId = req.user?.id;
    const data = await this.farmLayoutService.publish(id, dto, userId, ip);
    return { success: true, data };
  }

  @Post('version/:id/rollback')
  @RequirePermission('farm.manage_crop')
  async rollback(
    @Param('id') id: string,
    @Body() dto: RollbackLayoutDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    const userId = req.user?.id;
    const data = await this.farmLayoutService.rollback(id, dto.targetVersionId, userId, ip);
    return { success: true, data };
  }

  @Get('plots/:plotIndex/usage')
  @RequirePermission('farm.view')
  async checkPlotUsage(@Param('plotIndex') plotIndex: string) {
    const data = await this.farmLayoutService.checkPlotUsage(Number(plotIndex));
    return { success: true, data };
  }

  @Delete('objects/:id')
  @RequirePermission('farm.manage_crop')
  async deleteObject(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    const data = await this.farmLayoutService.deleteObject(id, userId);
    return { success: true, data };
  }
}

// ==============================================================
// 2. ADMIN GARDEN ASSET CONTROLLER
// ==============================================================
@Controller('admin/farm/garden-assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminFarmGardenAssetController {
  constructor(
    private readonly gardenAssetService: FarmGardenAssetService,
  ) {}

  @Get()
  @RequirePermission('farm.view')
  async getAllAssets(@Query('category') category?: string) {
    const data = await this.gardenAssetService.getAllAssets(category);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermission('farm.view')
  async getAssetById(@Param('id') id: string) {
    const data = await this.gardenAssetService.getAssetById(id);
    return { success: true, data };
  }

  @Post('upload')
  @RequirePermission('farm.manage_crop')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
      fileFilter: (_req, file, callback) => {
        if (
          !file.originalname.match(/\.(png|webp|avif)$/i) &&
          !file.mimetype.match(/image\/(png|webp|avif)/i)
        ) {
          return callback(
            new BadRequestException('Chỉ chấp nhận file hình ảnh định dạng PNG, WebP hoặc AVIF!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadGardenAssetDto,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh để tải lên');
    }
    const userId = req.user?.id;
    const data = await this.gardenAssetService.handleAssetUpload(file, dto, userId);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermission('farm.manage_crop')
  async updateAssetConfig(
    @Param('id') id: string,
    @Body() dto: UpdateGardenAssetDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const data = await this.gardenAssetService.updateAssetConfig(id, dto, userId);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermission('farm.manage_crop')
  async deleteAsset(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    const data = await this.gardenAssetService.deleteAsset(id, userId);
    return { success: true, data };
  }
}

// ==============================================================
// 3. PUBLIC USER FARM LAYOUT CONTROLLER (cho /farm người dùng)
// ==============================================================
@Controller('farm/layout')
export class FarmLayoutController {
  constructor(
    private readonly farmLayoutService: FarmLayoutService,
  ) {}

  @Get('active')
  async getActivePublishedLayout() {
    const data = await this.farmLayoutService.getActivePublishedLayout();
    return { success: true, data };
  }
}
