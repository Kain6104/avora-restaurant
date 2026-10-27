import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

export interface CategoryImportSummary {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  deactivatedProductsCount: number;
  warnings: string[];
  errors: { row: number; message: string }[];
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  cleanSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async generateUniqueCategorySlug(name: string, excludeId?: string): Promise<string> {
    const baseSlug = this.cleanSlug(name) || 'danh-muc';
    let currentSlug = baseSlug;
    let counter = 2;

    while (true) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: currentSlug },
      });
      if (!existing || (excludeId && existing.id === excludeId)) {
        return currentSlug;
      }
      currentSlug = `${baseSlug}-dm${counter}`;
      counter++;
    }
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    branchIdScope?: string;
  }) {
    const { skip = 0, take = 10, search, branchIdScope } = params;
    
    const where: any = {};
    
    if (branchIdScope) {
      where.branches = {
        some: { id: branchIdScope }
      };
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        skip,
        take,
        where,
        include: {
          branches: { select: { id: true, name: true } },
          _count: { 
            select: { 
              products: branchIdScope ? {
                where: { branches: { some: { id: branchIdScope } } }
              } : true 
            } 
          }
        },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Math.floor(skip / take) + 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      }
    };
  }

  async create(data: any) {
    const { name, slug, description, displayOrder, image } = data;
    const finalSlug = slug ? this.cleanSlug(slug) : await this.generateUniqueCategorySlug(name);
    return this.prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        description,
        displayOrder: displayOrder ? Number(displayOrder) : 0,
        image,
      }
    });
  }

  async update(id: string, data: any) {
    const { name, slug, description, displayOrder, image } = data;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug ? this.cleanSlug(slug) : await this.generateUniqueCategorySlug(name || 'danh-muc', id);
    if (description !== undefined) updateData.description = description;
    if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);
    if (image !== undefined) updateData.image = image;

    return this.prisma.category.update({
      where: { id },
      data: updateData
    });
  }

  async remove(id: string) {
    return this.prisma.category.delete({
      where: { id }
    });
  }

  // ══════════════════════════════════════════════════════════════
  // EXCEL EXPORT & IMPORT
  // ══════════════════════════════════════════════════════════════

  async exportCategoriesToExcel(): Promise<Buffer> {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: { select: { products: true } }
      },
      orderBy: { displayOrder: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('DANH_MUC', {
      views: [{ state: 'frozen', ySplit: 2 }],
      properties: { tabColor: { argb: 'FF800020' } },
    });

    // Title banner
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DANH SÁCH DANH MỤC THỰC ĐƠN AVORA RESTAURANT';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800020' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    // Header definition
    sheet.getRow(2).values = [
      'MÃ ID (KHÔNG SỬA ĐỂ CẬP NHẬT)',
      'TÊN DANH MỤC (*)',
      'ĐƯỜNG DẪN TĨNH (SLUG)',
      'URL HÌNH ẢNH (ẢNH DANH MỤC)',
      'THỨ TỰ HIỂN THỊ',
      'MÔ TẢ DANH MỤC',
      'SỐ LƯỢNG MÓN (THAM KHẢO)'
    ];
    sheet.getRow(2).height = 28;

    sheet.columns = [
      { key: 'id', width: 38 },
      { key: 'name', width: 28 },
      { key: 'slug', width: 26 },
      { key: 'image', width: 45 },
      { key: 'displayOrder', width: 18 },
      { key: 'description', width: 40 },
      { key: 'productsCount', width: 24 }
    ];

    sheet.getRow(2).eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    // Populate data
    categories.forEach((cat, idx) => {
      const row = sheet.addRow([
        cat.id,
        cat.name,
        cat.slug,
        cat.image || '',
        cat.displayOrder || 0,
        cat.description || '',
        cat._count.products || 0
      ]);
      row.height = 22;

      const isEven = idx % 2 === 0;
      row.eachCell((cell, colNumber) => {
        cell.font = { size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 || colNumber === 3 || colNumber === 5 || colNumber === 7 ? 'center' : 'left',
          wrapText: colNumber === 6
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF9FAFB' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    const uint8 = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8);
  }

  async generateExcelTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant';

    const sheet = workbook.addWorksheet('DANH_MUC_MAU', {
      views: [{ state: 'frozen', ySplit: 2 }],
      properties: { tabColor: { argb: 'FF800020' } },
    });

    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'FILE MẪU NHẬP DANH MỤC THỰC ĐƠN AVORA';
    titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800020' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.getRow(2).values = [
      'MÃ ID (Để trống nếu thêm mới)',
      'TÊN DANH MỤC (*)',
      'ĐƯỜNG DẪN TĨNH (SLUG)',
      'URL HÌNH ẢNH (ẢNH DANH MỤC)',
      'THỨ TỰ HIỂN THỊ',
      'MÔ TẢ DANH MỤC'
    ];
    sheet.getRow(2).height = 26;

    sheet.columns = [
      { key: 'id', width: 32 },
      { key: 'name', width: 28 },
      { key: 'slug', width: 24 },
      { key: 'image', width: 50 },
      { key: 'displayOrder', width: 18 },
      { key: 'description', width: 40 }
    ];

    sheet.getRow(2).eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const sampleRows = [
      ['', 'Nước Ép Trái Cây', 'nuoc-ep-trai-cay', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', 1, 'Nước ép trái cây tươi nguyên chất mỗi ngày'],
      ['', 'Sushi & Maki', 'sushi-maki', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500', 2, 'Sushi tươi ngon thượng hạng phong cách Nhật'],
      ['', 'Sashimi Tươi Sống', 'sashimi-tuoi-song', 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500', 3, 'Hải sản nhập khẩu trực tiếp từ Nhật Bản'],
      ['', 'Lẩu & Món Nóng', 'lau-mon-nong', 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500', 4, 'Các món lẩu đặc sắc và món nướng thơm lừng'],
    ];

    sampleRows.forEach(r => sheet.addRow(r));

    const guideSheet = workbook.addWorksheet('HUONG_DAN_SU_DUNG');
    guideSheet.columns = [{ width: 5 }, { width: 80 }];
    guideSheet.addRow(['', 'HƯỚNG DẪN NHẬP DỮ LIỆU DANH MỤC TỪ EXCEL']);
    guideSheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF800020' } };
    guideSheet.addRow([]);
    guideSheet.addRow(['', '1. CHẾ ĐỘ CẬP NHẬT & THÊM MỚI (UPSERT) - Khuyên dùng:']);
    guideSheet.addRow(['', '   - Cập nhật danh mục trùng Mã ID, Slug hoặc Tên danh mục.']);
    guideSheet.addRow(['', '   - Thêm mới nếu chưa có. Giữ nguyên các danh mục khác trong hệ thống.']);
    guideSheet.addRow(['', '   - Dùng để cập nhật nhanh link ảnh (URL Hình ảnh) cho tất cả danh mục.']);
    guideSheet.addRow([]);
    guideSheet.addRow(['', '2. CHẾ ĐỘ GHI ĐÈ & TẮT MÓN CŨ (REPLACE):']);
    guideSheet.addRow(['', '   - Đồng bộ danh mục theo file tải lên.']);
    guideSheet.addRow(['', '   - Các món thuộc danh mục KHÔNG CÓ trong file tải lên sẽ chuyển sang "Tạm ngưng bán".']);

    const uint8 = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8);
  }

  async importCategoriesFromExcel(fileBuffer: Buffer, mode: 'UPSERT' | 'REPLACE'): Promise<CategoryImportSummary> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('File Excel không có sheet dữ liệu nào!');
    }

    const summary: CategoryImportSummary = {
      totalProcessed: 0,
      createdCount: 0,
      updatedCount: 0,
      deactivatedProductsCount: 0,
      warnings: [],
      errors: []
    };

    // Header detection
    let headerRowIndex = 1;
    let headerMap = new Map<string, number>();

    for (let r = 1; r <= 5; r++) {
      const row = sheet.getRow(r);
      let foundName = false;
      row.eachCell((cell, colNumber) => {
        const val = this.cleanSlug(String(cell.value || ''));
        if (val.includes('ten') || val.includes('name') || val.includes('danh-muc')) {
          foundName = true;
        }
      });
      if (foundName) {
        headerRowIndex = r;
        row.eachCell((cell, colNumber) => {
          const val = this.cleanSlug(String(cell.value || ''));
          headerMap.set(val, colNumber);
        });
        break;
      }
    }

    const getVal = (row: ExcelJS.Row, keys: string[]): string => {
      for (const [header, col] of headerMap.entries()) {
        for (const k of keys) {
          if (header.includes(k)) {
            const cellVal = row.getCell(col).value;
            if (cellVal === null || cellVal === undefined) return '';
            if (typeof cellVal === 'object' && (cellVal as any).text) return String((cellVal as any).text).trim();
            if (typeof cellVal === 'object' && (cellVal as any).result !== undefined) return String((cellVal as any).result).trim();
            return String(cellVal).trim();
          }
        }
      }
      return '';
    };

    const existingCategories = await this.prisma.category.findMany();
    const processedCategoryIds = new Set<string>();

    for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const name = getVal(row, ['ten', 'name', 'danh-muc']);
      if (!name) continue; // Skip empty row

      summary.totalProcessed++;
      const id = getVal(row, ['id', 'ma']);
      const slugRaw = getVal(row, ['slug', 'duong-dan']);
      const image = getVal(row, ['anh', 'image', 'url', 'hinh']);
      const displayOrderRaw = getVal(row, ['thu-tu', 'order', 'hien-thi']);
      const description = getVal(row, ['mo-ta', 'desc']);

      const displayOrder = displayOrderRaw ? parseInt(displayOrderRaw, 10) || 0 : 0;

      // Find match
      let matched = existingCategories.find(c => {
        if (id && c.id === id) return true;
        if (slugRaw && this.cleanSlug(c.slug) === this.cleanSlug(slugRaw)) return true;
        if (this.cleanSlug(c.name) === this.cleanSlug(name)) return true;
        return false;
      });

      try {
        if (matched) {
          const targetSlug = slugRaw ? this.cleanSlug(slugRaw) : matched.slug;
          const updated = await this.prisma.category.update({
            where: { id: matched.id },
            data: {
              name,
              slug: targetSlug,
              image: image || matched.image,
              displayOrder: displayOrderRaw !== '' ? displayOrder : matched.displayOrder,
              description: description || matched.description
            }
          });
          processedCategoryIds.add(updated.id);
          summary.updatedCount++;
        } else {
          const generatedSlug = slugRaw ? this.cleanSlug(slugRaw) : await this.generateUniqueCategorySlug(name);
          const created = await this.prisma.category.create({
            data: {
              name,
              slug: generatedSlug,
              image: image || null,
              displayOrder,
              description: description || null
            }
          });
          processedCategoryIds.add(created.id);
          summary.createdCount++;
        }
      } catch (err: any) {
        summary.errors.push({ row: r, message: `Lỗi dòng ${r} (${name}): ${err.message}` });
      }
    }

    // REPLACE mode: "Chuyển sang Tạm ngưng bán cho các món không nằm trong file tải lên"
    if (mode === 'REPLACE') {
      const allCategoryIds = existingCategories.map(c => c.id);
      const categoriesToDeactivate = allCategoryIds.filter(id => !processedCategoryIds.has(id));

      if (categoriesToDeactivate.length > 0) {
        const updateResult = await this.prisma.product.updateMany({
          where: {
            categoryId: { in: categoriesToDeactivate },
            available: true
          },
          data: {
            available: false
          }
        });
        summary.deactivatedProductsCount = updateResult.count;
      }
    }

    return summary;
  }
}
