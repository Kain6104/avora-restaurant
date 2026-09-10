import { Controller, Get, Param, Patch, Post, Delete, Body, Query, UseGuards, Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsExcelService: ProductsExcelService,
  ) {}

  @Get()
  @RequirePermission('products.view')
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '12',
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 12;
    const skip = (pageNumber - 1) * limitNumber;

    return this.productsService.findAll({
      skip,
      take: limitNumber,
      search,
      categoryId,
      branchIdScope,
      status,
      channel,
    });
  }

  @Get('export/excel')
  @RequirePermission('products.export')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.productsExcelService.exportProductsToExcel();
    const filename = `AVORA_Menu_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  @Get('export/template')
  @RequirePermission('products.view')
  async exportTemplate(@Res() res: Response) {
    const buffer = await this.productsExcelService.generateExcelTemplate();
    const filename = `AVORA_Menu_Template.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  @Post('import/excel')
  @RequirePermission('products.import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
          return callback(new BadRequestException('Chỉ chấp nhận file định dạng Excel (.xlsx, .xls)!'), false);
        }
        callback(null, true);
      },
    }),
  )
  async importExcel(
    @UploadedFile() file: any,
    @Query('mode') mode?: 'UPSERT' | 'REPLACE',
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn file Excel để tải lên!');
    }
    const summary = await this.productsExcelService.importProductsFromExcel(file.buffer, mode || 'UPSERT');
    return {
      success: true,
      data: summary,
      message: `Nhập dữ liệu thành công: Tạo mới ${summary.createdCount} món, cập nhật ${summary.updatedCount} món.`,
    };
  }

  @Get(':id')
  @RequirePermission('products.view')
  async findOne(@Param('id') id: string) {
    const data = await this.productsService.findOne(id);
    return { data, message: 'Success' };
  }

  @Patch(':id/toggle')
  @RequirePermission('products.availability.update')
  async toggleAvailability(
    @Param('id') id: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.productsService.toggleAvailability(id, branchIdScope);
    return { data, message: 'Updated product availability successfully' };
  }

  @Post()
  @RequirePermission('products.create')
  async create(@Body() data: any) {
    const result = await this.productsService.create(data);
    return { data: result, message: 'Created product successfully' };
  }

  @Patch(':id')
  @RequirePermission('products.update')
  async update(@Param('id') id: string, @Body() data: any) {
    const result = await this.productsService.update(id, data);
    return { data: result, message: 'Updated product successfully' };
  }

  @Delete(':id')
  @RequirePermission('products.delete')
  async remove(@Param('id') id: string) {
    const result = await this.productsService.remove(id);
    return { data: result, message: 'Deleted product successfully' };
  }
}
