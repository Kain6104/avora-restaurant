import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Param, 
  Body, 
  Query, 
  UseGuards, 
  Res, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException 
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('export/excel')
  @RequirePermission('categories.view')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.categoriesService.exportCategoriesToExcel();
    const filename = `AVORA_Categories_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  @Get('export/template')
  @RequirePermission('categories.view')
  async exportTemplate(@Res() res: Response) {
    const buffer = await this.categoriesService.generateExcelTemplate();
    const filename = `AVORA_Categories_Template.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  @Post('import/excel')
  @RequirePermission('categories.create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
          return callback(new BadRequestException('Chỉ chấp nhận file định dạng Excel (.xlsx, .xls)!'), false);
        }
        callback(null, true);
      },
    }),
  )
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query('mode') mode: 'UPSERT' | 'REPLACE' = 'UPSERT',
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn file Excel để tải lên!');
    }
    const result = await this.categoriesService.importCategoriesFromExcel(file.buffer, mode);
    return {
      success: true,
      message: 'Nhập dữ liệu danh mục từ Excel hoàn tất',
      data: result,
    };
  }

  @Get()
  @RequirePermission('categories.view')
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    return this.categoriesService.findAll({
      skip,
      take: limitNumber,
      search,
      branchIdScope,
    });
  }

  @Post()
  @RequirePermission('categories.create')
  async create(@Body() data: any) {
    const result = await this.categoriesService.create(data);
    return { data: result, message: 'Created category successfully' };
  }

  @Patch(':id')
  @RequirePermission('categories.update')
  async update(@Param('id') id: string, @Body() data: any) {
    const result = await this.categoriesService.update(id, data);
    return { data: result, message: 'Updated category successfully' };
  }

  @Delete(':id')
  @RequirePermission('categories.delete')
  async remove(@Param('id') id: string) {
    const result = await this.categoriesService.remove(id);
    return { data: result, message: 'Deleted category successfully' };
  }
}
