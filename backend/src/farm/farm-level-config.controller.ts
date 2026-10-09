import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { FarmLevelConfigService } from './farm-level-config.service';
import { CreateLevelConfigDto, UpdateLevelConfigDto } from './dto/farm-level-config.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('admin/farm/levels')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('farm.manage_crop')
export class AdminFarmLevelConfigController {
  constructor(private readonly levelConfigService: FarmLevelConfigService) {}

  @Get()
  async getAllLevels() {
    const levels = await this.levelConfigService.getAllLevels();
    return { success: true, data: levels };
  }

  @Get(':level')
  async getLevel(@Param('level', ParseIntPipe) level: number) {
    const data = await this.levelConfigService.getLevel(level);
    return { success: true, data };
  }

  @Put(':level')
  async upsertLevel(
    @Param('level', ParseIntPipe) level: number,
    @Body() dto: UpdateLevelConfigDto,
  ) {
    const updated = await this.levelConfigService.upsertLevel(level, dto);
    return { success: true, message: `Đã lưu cấu hình Cấp độ ${level}`, data: updated };
  }

  @Post()
  async createLevel(@Body() dto: CreateLevelConfigDto) {
    const created = await this.levelConfigService.createLevel(dto);
    return { success: true, message: `Đã tạo mới Cấp độ ${dto.level}`, data: created };
  }

  @Delete(':level')
  async deleteLevel(@Param('level', ParseIntPipe) level: number) {
    const result = await this.levelConfigService.deleteLevel(level);
    return result;
  }
}

@Controller('farm/levels')
export class FarmLevelController {
  constructor(private readonly levelConfigService: FarmLevelConfigService) {}

  @Get()
  async getLevels() {
    const levels = await this.levelConfigService.getAllLevels();
    return { success: true, data: levels };
  }
}
