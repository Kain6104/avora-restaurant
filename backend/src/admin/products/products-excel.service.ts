import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { PrintRouteRole, PrintTemplateType } from '@prisma/client';

export interface ImportResultSummary {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  optionGroupsSynced: number;
  optionItemsSynced: number;
  printRoutesSynced: number;
  deactivatedCount: number;
  warnings: string[];
  errors: { row: number; sheet: string; message: string }[];
}

@Injectable()
export class ProductsExcelService {
  private readonly logger = new Logger(ProductsExcelService.name);

  // AVORA Brand Color Palettes for Excel styling
  private readonly BRAND_PRIMARY = '800020'; // Burgundy
  private readonly BRAND_SECONDARY = 'B91C1C'; // Red 700
  private readonly BRAND_ACCENT = 'F1F5F9'; // Light gray
  private readonly BRAND_DARK = '1E293B'; // Slate 800

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xuất toàn bộ dữ liệu món ăn ra file Excel (Multi-Sheet chuyên nghiệp)
   */
  async exportProductsToExcel(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant Management System';
    workbook.created = new Date();

    const [products, categories, branches, stations] = await Promise.all([
      this.prisma.product.findMany({
        include: {
          category: true,
          branches: { select: { id: true, name: true, branchCode: true } },
          redeemableBranches: { select: { id: true, name: true, branchCode: true } },
          optionGroups: {
            include: { optionItems: { orderBy: { displayOrder: 'asc' } } },
            orderBy: { displayOrder: 'asc' },
          },
          printRoutes: {
            include: {
              branch: { select: { id: true, name: true, branchCode: true } },
              station: { select: { id: true, name: true, code: true } },
            },
            orderBy: { priority: 'asc' },
          },
        },
        orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.category.findMany({ orderBy: { displayOrder: 'asc' } }),
      this.prisma.branch.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.kitchenStation.findMany({
        include: { branch: { select: { branchCode: true, name: true } } },
        orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
      }),
    ]);

    // ==========================================
    // SHEET 1: Danh sách món ăn
    // ==========================================
    const sheet1 = workbook.addWorksheet('Danh sách món ăn', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet1.columns = [
      { header: 'Mã món (*)', key: 'itemCode', width: 14 },
      { header: 'Tên món ăn (*)', key: 'name', width: 28 },
      { header: 'Danh mục (*)', key: 'categoryName', width: 20 },
      { header: 'Giá bán (VNĐ) (*)', key: 'price', width: 16 },
      { header: 'Giá gốc (VNĐ)', key: 'oldPrice', width: 15 },
      { header: 'Giá khuyến mãi (VNĐ)', key: 'discountedPrice', width: 20 },
      { header: 'Đơn vị tính', key: 'unit', width: 12 },
      { header: 'Thuế VAT (%)', key: 'taxPercentage', width: 13 },
      { header: 'KÊNH BÁN HÀNG', key: 'salesChannels', width: 34 },
      { header: 'Mô tả món', key: 'description', width: 35 },
      { header: 'Link ảnh đại diện', key: 'imageUrl', width: 30 },
      { header: 'LINK VIDEO REVIEW', key: 'videoUrl', width: 30 },
      { header: 'ẢNH PHỤ (GALLERY)', key: 'secondaryImages', width: 35 },
      { header: 'Trạng thái bán', key: 'available', width: 14 },
      { header: 'Bán chạy', key: 'isBestSeller', width: 12 },
      { header: 'AI Gợi ý', key: 'isAiRecommended', width: 12 },
      { header: 'Độ cay (0-3)', key: 'spiciness', width: 12 },
      { header: 'Đối tượng', key: 'targetAudience', width: 16 },
      { header: 'Huy hiệu', key: 'badge', width: 12 },
      { header: 'Cho phép đổi điểm', key: 'isRedeemable', width: 18 },
      { header: 'Số điểm đổi món', key: 'redemptionPoints', width: 16 },
      { header: 'CHI NHÁNH ĐỔI ĐIỂM', key: 'redeemableBranches', width: 25 },
      { header: 'Chi nhánh áp dụng', key: 'branches', width: 25 },
      { header: 'Tóm tắt tùy chọn', key: 'optionsSummary', width: 40 },
      { header: 'LOẠI MÁY IN GỬI ĐẾN', key: 'printerType', width: 25 },
      { header: 'MÁY IN BẾP & CHẾ BIẾN KITCHEN', key: 'kitchenStation', width: 30 },
      { header: 'SỐ LIÊN IN BẾP', key: 'kitchenCopies', width: 14 },
      { header: 'TEM_LABEL (IN TEM NHÃN)', key: 'temLabel', width: 24 },
      { header: 'SỐ LIÊN IN TEM', key: 'labelCopies', width: 14 },
    ];

    products.forEach((p) => {
      // Tóm tắt option groups
      const optSummary = (p.optionGroups || [])
        .map((g) => {
          const itemsStr = (g.optionItems || [])
            .map((i) => `${i.name}${i.priceAdjustment > 0 ? ` (+${i.priceAdjustment.toLocaleString('vi-VN')}đ)` : ''}`)
            .join(', ');
          return `${g.name}: [${itemsStr}]`;
        })
        .join('; ');

      // Tìm trạm bếp / chế biến
      const kitchenRoute = (p.printRoutes || []).find(
        (r) => r.printType === PrintTemplateType.KITCHEN_TICKET || r.printType === PrintTemplateType.KITCHEN || r.routeRole === PrintRouteRole.PREPARATION
      );
      const kitchenStation = kitchenRoute?.station?.name || kitchenRoute?.station?.code || '';
      const kitchenCopies = kitchenRoute?.copies || 1;

      // Tìm route in tem nhãn (ITEM_LABEL)
      const labelRoute = (p.printRoutes || []).find(
        (r) => (r.printType === PrintTemplateType.ITEM_LABEL || r.routeRole === PrintRouteRole.LABEL) && r.isActive
      );
      const temLabel = labelRoute ? 'TRUE' : 'FALSE';
      const labelCopies = labelRoute?.copies || 1;

      // Tổng hợp các loại máy in
      const printerTypesSet = new Set((p.printRoutes || []).map((r) => r.printType));
      const printerType = printerTypesSet.size > 0
        ? Array.from(printerTypesSet).join(', ')
        : (kitchenRoute ? 'KITCHEN' : 'RECEIPT');

      // Chi nhánh áp dụng
      const branchCodes = (p.branches || []).map((b) => b.branchCode || b.name).join(', ');

      // Kênh bán hàng
      const channels = Array.isArray(p.salesChannels)
        ? (p.salesChannels as string[]).join(', ')
        : 'DINE_IN, TAKEAWAY, ONLINE_DELIVERY, GRAB_FOOD, SHOPEE_FOOD, QR_ORDER';

      // Chi nhánh đổi điểm
      const redeemBranches = p.redeemAllBranches
        ? 'Tất cả'
        : (p.redeemableBranches || []).map((b) => b.branchCode || b.name).join(', ') || 'Tất cả';

      // Ảnh phụ
      const secondaryImgs = Array.isArray(p.secondaryImages)
        ? (p.secondaryImages as string[]).join(', ')
        : '';

      sheet1.addRow({
        itemCode: p.itemCode,
        name: p.name,
        categoryName: p.category?.name || '',
        price: p.price,
        oldPrice: p.oldPrice || null,
        discountedPrice: p.discountedPrice || null,
        unit: p.unit || 'phần',
        taxPercentage: p.taxPercentage ?? 0,
        salesChannels: channels,
        description: p.description || '',
        imageUrl: p.imageUrl || '',
        videoUrl: p.videoUrl || '',
        secondaryImages: secondaryImgs,
        available: p.available ? 'TRUE' : 'FALSE',
        isBestSeller: p.isBestSeller ? 'TRUE' : 'FALSE',
        isAiRecommended: p.isAiRecommended ? 'TRUE' : 'FALSE',
        spiciness: p.spiciness ?? 0,
        targetAudience: p.targetAudience || 'Mọi lứa tuổi',
        badge: p.badge || '',
        isRedeemable: p.isRedeemable ? 'TRUE' : 'FALSE',
        redemptionPoints: p.redemptionPoints || null,
        redeemableBranches: redeemBranches,
        branches: branchCodes.length > 0 ? branchCodes : 'Tất cả',
        optionsSummary: optSummary,
        printerType,
        kitchenStation,
        kitchenCopies,
        temLabel,
        labelCopies,
      });
    });

    this.styleHeader(sheet1);
    this.formatDataRows(sheet1, [4, 5, 6]);

    // ==========================================
    // SHEET 2: Nhóm tùy chọn & Topping
    // ==========================================
    const sheet2 = workbook.addWorksheet('Nhóm tùy chọn & Topping', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet2.columns = [
      { header: 'Mã món (*)', key: 'itemCode', width: 14 },
      { header: 'Tên món ăn', key: 'productName', width: 26 },
      { header: 'Tên nhóm tùy chọn (*)', key: 'groupName', width: 22 },
      { header: 'Bắt buộc chọn', key: 'isRequired', width: 14 },
      { header: 'Chọn nhiều', key: 'multipleChoice', width: 13 },
      { header: 'Chọn tối thiểu', key: 'minSelect', width: 14 },
      { header: 'Chọn tối đa', key: 'maxSelect', width: 14 },
      { header: 'Thứ tự nhóm', key: 'groupOrder', width: 13 },
      { header: 'Tên lựa chọn / Topping (*)', key: 'optionItemName', width: 24 },
      { header: 'Giá cộng thêm (VNĐ)', key: 'priceAdjustment', width: 18 },
      { header: 'Mặc định chọn', key: 'isDefault', width: 14 },
      { header: 'Còn hàng', key: 'available', width: 12 },
      { header: 'Số lượng tối đa', key: 'maxQuantity', width: 15 },
      { header: 'Thứ tự lựa chọn', key: 'itemOrder', width: 15 },
    ];

    products.forEach((p) => {
      (p.optionGroups || []).forEach((g, gIdx) => {
        (g.optionItems || []).forEach((item, iIdx) => {
          sheet2.addRow({
            itemCode: p.itemCode,
            productName: p.name,
            groupName: g.name,
            isRequired: g.isRequired ? 'TRUE' : 'FALSE',
            multipleChoice: g.multipleChoice ? 'TRUE' : 'FALSE',
            minSelect: g.minSelect ?? 0,
            maxSelect: g.maxSelect ?? 1,
            groupOrder: g.displayOrder ?? gIdx,
            optionItemName: item.name,
            priceAdjustment: item.priceAdjustment || 0,
            isDefault: item.isDefault ? 'TRUE' : 'FALSE',
            available: item.available ? 'TRUE' : 'FALSE',
            maxQuantity: item.maxQuantity ?? 1,
            itemOrder: item.displayOrder ?? iIdx,
          });
        });
      });
    });

    this.styleHeader(sheet2);
    this.formatDataRows(sheet2, [10]);

    // ==========================================
    // SHEET 3: Định tuyến máy in trạm bếp
    // ==========================================
    const sheet3 = workbook.addWorksheet('Định tuyến máy in trạm bếp', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet3.columns = [
      { header: 'Mã món (*)', key: 'itemCode', width: 14 },
      { header: 'Tên món ăn', key: 'productName', width: 26 },
      { header: 'Chi nhánh (*)', key: 'branchName', width: 22 },
      { header: 'Trạm bếp / Quầy bar (*)', key: 'stationName', width: 25 },
      { header: 'Vai trò in', key: 'routeRole', width: 16 },
      { header: 'Loại phiếu in', key: 'printType', width: 18 },
      { header: 'Số liên in', key: 'copies', width: 12 },
      { header: 'Đang kích hoạt', key: 'isActive', width: 14 },
    ];

    products.forEach((p) => {
      (p.printRoutes || []).forEach((r) => {
        sheet3.addRow({
          itemCode: p.itemCode,
          productName: p.name,
          branchName: r.branch?.name || r.branch?.branchCode || '',
          stationName: r.station?.name || r.station?.code || '',
          routeRole: r.routeRole || 'PREPARATION',
          printType: r.printType || 'KITCHEN_TICKET',
          copies: r.copies || 1,
          isActive: r.isActive ? 'TRUE' : 'FALSE',
        });
      });
    });

    this.styleHeader(sheet3);
    this.formatDataRows(sheet3, []);

    // ==========================================
    // SHEET 4: Danh mục & Chi nhánh (Tra cứu)
    // ==========================================
    const sheet4 = workbook.addWorksheet('Danh mục & Chi nhánh (Tra cứu)');
    sheet4.columns = [
      { header: 'DANH MỤC CÓ SẴN', key: 'catCol', width: 28 },
      { header: '', key: 'blank1', width: 4 },
      { header: 'CHI NHÁNH CÓ SẴN', key: 'branchCol', width: 32 },
      { header: 'MÃ CN', key: 'branchCodeCol', width: 12 },
      { header: '', key: 'blank2', width: 4 },
      { header: 'TRẠM BẾP / BAR THEO CHI NHÁNH', key: 'stationCol', width: 30 },
      { header: 'MÃ TRẠM', key: 'stationCodeCol', width: 16 },
      { header: 'CHI NHÁNH', key: 'stationBranchCol', width: 20 },
    ];

    const maxRows = Math.max(categories.length, branches.length, stations.length);
    for (let i = 0; i < maxRows; i++) {
      const cat = categories[i];
      const br = branches[i];
      const st = stations[i];
      sheet4.addRow({
        catCol: cat ? cat.name : '',
        blank1: '',
        branchCol: br ? br.name : '',
        branchCodeCol: br ? br.branchCode || '' : '',
        blank2: '',
        stationCol: st ? st.name : '',
        stationCodeCol: st ? st.code : '',
        stationBranchCol: st ? st.branch?.name || st.branch?.branchCode || '' : '',
      });
    }
    this.styleHeader(sheet4);

    // ==========================================
    // SHEET 5: Hướng dẫn sử dụng & Quy ước
    // ==========================================
    const sheet5 = workbook.addWorksheet('Hướng dẫn sử dụng');
    sheet5.columns = [
      { header: 'Nội dung hướng dẫn', key: 'guide', width: 90 },
    ];
    sheet5.addRows([
      { guide: 'QUY TẮC NHẬP DỮ LIỆU EXCEL CHO HỆ THỐNG AVORA' },
      { guide: '1. Các cột có dấu (*) là thông tin BẮT BUỘC: Mã món, Tên món ăn, Danh mục, Giá bán.' },
      { guide: '2. Mã món (itemCode): Định danh duy nhất của món. Nếu để trống, hệ thống sẽ tự sinh mã.' },
      { guide: '3. Giá bán: Nhập số nguyên không dấu cách hoặc ký tự tiền tệ (Ví dụ: 145000).' },
      { guide: '4. Giá trị logic (Bật / Tắt): Sử dụng "TRUE" hoặc "FALSE" để chỉnh sửa nhanh (Trạng thái bán, Bán chạy, AI Gợi ý, Cho phép đổi điểm, TEM_LABEL...).' },
      { guide: '5. Thiết lập máy in bếp & tem nhãn nhanh (Ngay tại Sheet 1):' },
      { guide: '   - "MÁY IN BẾP & CHẾ BIẾN KITCHEN": Điền tên hoặc mã trạm bếp (ví dụ: Bếp Nóng & Món Chính, Quầy Bar, Bếp Bánh...).' },
      { guide: '   - "SỐ LIÊN IN BẾP": Số phiếu cần in khi có đơn (mặc định 1).' },
      { guide: '   - "TEM_LABEL (IN TEM NHÃN)": Điền TRUE nếu muốn in tem dán lên ly/hộp (đồ uống, món mang đi), FALSE nếu không in.' },
      { guide: '   - "SỐ LIÊN IN TEM": Số tem dán cần in (mặc định 1).' },
      { guide: '6. Cơ chế tích điểm & đổi điểm:' },
      { guide: '   - "Cho phép đổi điểm": Điền TRUE nếu muốn khách có thể đổi điểm lấy món này, FALSE nếu không áp dụng.' },
      { guide: '   - "Số điểm đổi món": Nhập số điểm cần để đổi (Ví dụ: 150).' },
      { guide: '7. Nhóm tùy chọn & Topping (Sheet 2):' },
      { guide: '   - Khớp với món ăn qua cột "Mã món (*)".' },
      { guide: '   - Một món có thể có nhiều nhóm (ví dụ: Chọn Size, Mức đường, Topping).' },
      { guide: '   - Mỗi nhóm có thể có nhiều lựa chọn con (Option Items).' },
      { guide: '8. Định tuyến máy in trạm bếp chi tiết theo từng chi nhánh (Sheet 3):' },
      { guide: '   - Dùng khi bạn muốn cấu hình riêng biệt từng máy in cụ thể theo từng chi nhánh khác nhau.' },
      { guide: '9. Chế độ Import:' },
      { guide: '   - Cập nhật & Thêm mới (UPSERT): Trùng mã món sẽ cập nhật thông tin, chưa có sẽ thêm mới.' },
      { guide: '   - Thay thế toàn bộ (REPLACE): Các món không nằm trong file Excel sẽ chuyển sang Tạm ngưng bán.' },
    ]);
    sheet5.getRow(1).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet5.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${this.BRAND_PRIMARY}` } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Tạo file Excel mẫu chuẩn (Template) kèm 3 món ăn minh họa đầy đủ
   */
  async generateExcelTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AVORA Restaurant Management System';

    const [categories, branches, stations] = await Promise.all([
      this.prisma.category.findMany({ orderBy: { displayOrder: 'asc' } }),
      this.prisma.branch.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.kitchenStation.findMany({
        include: { branch: { select: { branchCode: true, name: true } } },
        orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const defaultCat = categories[0]?.name || 'Món Nóng & Bếp';
    const defaultBranch = branches[0]?.name || 'Avora West Lake';
    const defaultStation = stations[0]?.name || 'Bếp Nóng & Món Chính';

    // Sheet 1: Mẫu Món ăn
    const sheet1 = workbook.addWorksheet('Danh sách món ăn', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet1.columns = [
      { header: 'Mã món (*)', key: 'itemCode', width: 14 },
      { header: 'Tên món ăn (*)', key: 'name', width: 28 },
      { header: 'Danh mục (*)', key: 'categoryName', width: 20 },
      { header: 'Giá bán (VNĐ) (*)', key: 'price', width: 16 },
      { header: 'Giá gốc (VNĐ)', key: 'oldPrice', width: 15 },
      { header: 'Giá khuyến mãi (VNĐ)', key: 'discountedPrice', width: 20 },
      { header: 'Đơn vị tính', key: 'unit', width: 12 },
      { header: 'Thuế VAT (%)', key: 'taxPercentage', width: 13 },
      { header: 'KÊNH BÁN HÀNG', key: 'salesChannels', width: 34 },
      { header: 'Mô tả món', key: 'description', width: 35 },
      { header: 'Link ảnh đại diện', key: 'imageUrl', width: 30 },
      { header: 'LINK VIDEO REVIEW', key: 'videoUrl', width: 30 },
      { header: 'ẢNH PHỤ (GALLERY)', key: 'secondaryImages', width: 35 },
      { header: 'Trạng thái bán', key: 'available', width: 14 },
      { header: 'Bán chạy', key: 'isBestSeller', width: 12 },
      { header: 'AI Gợi ý', key: 'isAiRecommended', width: 12 },
      { header: 'Độ cay (0-3)', key: 'spiciness', width: 12 },
      { header: 'Đối tượng', key: 'targetAudience', width: 16 },
      { header: 'Huy hiệu', key: 'badge', width: 12 },
      { header: 'Cho phép đổi điểm', key: 'isRedeemable', width: 18 },
      { header: 'Số điểm đổi món', key: 'redemptionPoints', width: 16 },
      { header: 'CHI NHÁNH ĐỔI ĐIỂM', key: 'redeemableBranches', width: 25 },
      { header: 'Chi nhánh áp dụng', key: 'branches', width: 25 },
      { header: 'Tóm tắt tùy chọn', key: 'optionsSummary', width: 40 },
      { header: 'LOẠI MÁY IN GỬI ĐẾN', key: 'printerType', width: 25 },
      { header: 'MÁY IN BẾP & CHẾ BIẾN KITCHEN', key: 'kitchenStation', width: 30 },
      { header: 'SỐ LIÊN IN BẾP', key: 'kitchenCopies', width: 14 },
      { header: 'TEM_LABEL (IN TEM NHÃN)', key: 'temLabel', width: 24 },
      { header: 'SỐ LIÊN IN TEM', key: 'labelCopies', width: 14 },
    ];

    sheet1.addRows([
      {
        itemCode: 'MAU-001',
        name: 'Cơm Chiên Cá Hồi Nauy',
        categoryName: defaultCat,
        price: 145000,
        oldPrice: 165000,
        discountedPrice: 145000,
        unit: 'phần',
        taxPercentage: 8,
        salesChannels: 'DINE_IN, TAKEAWAY, ONLINE_DELIVERY, GRAB_FOOD, SHOPEE_FOOD, QR_ORDER',
        description: 'Cơm chiên hạt vàng thơm ngon kết hợp cá hồi tươi Nauy',
        imageUrl: 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=400',
        videoUrl: 'https://www.youtube.com/watch?v=sample1',
        secondaryImages: 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=600, https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600',
        available: 'TRUE',
        isBestSeller: 'TRUE',
        isAiRecommended: 'TRUE',
        spiciness: 0,
        targetAudience: 'Mọi lứa tuổi',
        badge: 'BEST SELLER',
        isRedeemable: 'FALSE',
        redemptionPoints: null,
        redeemableBranches: 'Tất cả',
        branches: 'Tất cả',
        optionsSummary: 'Lượng cơm: [Cơm vừa (Tiêu chuẩn), Thêm nhiều cơm (+10.000đ)]',
        printerType: 'KITCHEN',
        kitchenStation: defaultStation,
        kitchenCopies: 1,
        temLabel: 'FALSE',
        labelCopies: 1,
      },
      {
        itemCode: 'MAU-002',
        name: 'Trà Đào Cam Sả Hoàng Gia',
        categoryName: categories[1]?.name || 'Đồ Uống & Bar',
        price: 55000,
        oldPrice: null,
        discountedPrice: null,
        unit: 'ly',
        taxPercentage: 8,
        salesChannels: 'DINE_IN, TAKEAWAY, ONLINE_DELIVERY, GRAB_FOOD, SHOPEE_FOOD, QR_ORDER',
        description: 'Thanh mát với đào giòn, vị cam tươi và hương sả tự nhiên',
        imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400',
        videoUrl: 'https://www.tiktok.com/@avora/video/sample2',
        secondaryImages: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600',
        available: 'TRUE',
        isBestSeller: 'TRUE',
        isAiRecommended: 'FALSE',
        spiciness: 0,
        targetAudience: 'Giới trẻ',
        badge: 'HOT',
        isRedeemable: 'TRUE',
        redemptionPoints: 80,
        redeemableBranches: 'Tất cả',
        branches: 'Tất cả',
        optionsSummary: 'Độ ngọt: [100% Đường, 50% Đường]; Topping thêm: [Miếng Đào Thêm (+15.000đ)]',
        printerType: 'BAR, ITEM_LABEL',
        kitchenStation: stations.find((s) => s.code === 'BAR')?.name || 'Quầy Bar',
        kitchenCopies: 1,
        temLabel: 'TRUE',
        labelCopies: 1,
      },
      {
        itemCode: 'MAU-003',
        name: 'Bánh Mousse Chocolate Bỉ',
        categoryName: categories[2]?.name || 'Tráng Miệng',
        price: 75000,
        oldPrice: 85000,
        discountedPrice: null,
        unit: 'phần',
        taxPercentage: 8,
        salesChannels: 'DINE_IN, TAKEAWAY, ONLINE_DELIVERY',
        description: 'Bánh mousse chocolate nguyên chất béo ngậy mềm mịn',
        imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400',
        videoUrl: '',
        secondaryImages: '',
        available: 'TRUE',
        isBestSeller: 'FALSE',
        isAiRecommended: 'TRUE',
        spiciness: 0,
        targetAudience: 'Mọi lứa tuổi',
        badge: 'SPECIAL',
        isRedeemable: 'TRUE',
        redemptionPoints: 120,
        redeemableBranches: defaultBranch,
        branches: 'Tất cả',
        optionsSummary: '',
        printerType: 'KITCHEN',
        kitchenStation: stations.find((s) => s.code === 'DESSERT')?.name || 'Bếp Bánh & Tráng Miệng',
        kitchenCopies: 1,
        temLabel: 'FALSE',
        labelCopies: 1,
      },
    ]);
    this.styleHeader(sheet1);
    this.formatDataRows(sheet1, [4, 5, 6]);

    // Sheet 2: Mẫu Tùy chọn & Topping
    const sheet2 = workbook.addWorksheet('Nhóm tùy chọn & Topping', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet2.columns = [
      { header: 'Mã món (*)', key: 'itemCode', width: 14 },
      { header: 'Tên món ăn', key: 'productName', width: 26 },
      { header: 'Tên nhóm tùy chọn (*)', key: 'groupName', width: 22 },
      { header: 'Bắt buộc chọn', key: 'isRequired', width: 14 },
      { header: 'Chọn nhiều', key: 'multipleChoice', width: 13 },
      { header: 'Chọn tối thiểu', key: 'minSelect', width: 14 },
      { header: 'Chọn tối đa', key: 'maxSelect', width: 14 },
      { header: 'Thứ tự nhóm', key: 'groupOrder', width: 13 },
      { header: 'Tên lựa chọn / Topping (*)', key: 'optionItemName', width: 24 },
      { header: 'Giá cộng thêm (VNĐ)', key: 'priceAdjustment', width: 18 },
      { header: 'Mặc định chọn', key: 'isDefault', width: 14 },
      { header: 'Còn hàng', key: 'available', width: 12 },
      { header: 'Số lượng tối đa', key: 'maxQuantity', width: 15 },
      { header: 'Thứ tự lựa chọn', key: 'itemOrder', width: 15 },
    ];
    sheet2.addRows([
      {
        itemCode: 'MAU-001',
        productName: 'Cơm Chiên Cá Hồi Nauy',
        groupName: 'Lượng cơm',
        isRequired: 'TRUE',
        multipleChoice: 'FALSE',
        minSelect: 1,
        maxSelect: 1,
        groupOrder: 0,
        optionItemName: 'Cơm vừa (Tiêu chuẩn)',
        priceAdjustment: 0,
        isDefault: 'TRUE',
        available: 'TRUE',
        maxQuantity: 1,
        itemOrder: 0,
      },
      {
        itemCode: 'MAU-001',
        productName: 'Cơm Chiên Cá Hồi Nauy',
        groupName: 'Lượng cơm',
        isRequired: 'TRUE',
        multipleChoice: 'FALSE',
        minSelect: 1,
        maxSelect: 1,
        groupOrder: 0,
        optionItemName: 'Thêm nhiều cơm',
        priceAdjustment: 10000,
        isDefault: 'FALSE',
        available: 'TRUE',
        maxQuantity: 1,
        itemOrder: 1,
      },
      {
        itemCode: 'MAU-002',
        productName: 'Trà Đào Cam Sả Hoàng Gia',
        groupName: 'Độ ngọt',
        isRequired: 'TRUE',
        multipleChoice: 'FALSE',
        minSelect: 1,
        maxSelect: 1,
        groupOrder: 0,
        optionItemName: '100% Đường',
        priceAdjustment: 0,
        isDefault: 'TRUE',
        available: 'TRUE',
        maxQuantity: 1,
        itemOrder: 0,
      },
      {
        itemCode: 'MAU-002',
        productName: 'Trà Đào Cam Sả Hoàng Gia',
        groupName: 'Độ ngọt',
        isRequired: 'TRUE',
        multipleChoice: 'FALSE',
        minSelect: 1,
        maxSelect: 1,
        groupOrder: 0,
        optionItemName: '50% Đường',
        priceAdjustment: 0,
        isDefault: 'FALSE',
        available: 'TRUE',
        maxQuantity: 1,
        itemOrder: 1,
      },
      {
        itemCode: 'MAU-002',
        productName: 'Trà Đào Cam Sả Hoàng Gia',
        groupName: 'Topping thêm',
        isRequired: 'FALSE',
        multipleChoice: 'TRUE',
        minSelect: 0,
        maxSelect: 3,
        groupOrder: 1,
        optionItemName: 'Miếng Đào Thêm (3 miếng)',
        priceAdjustment: 15000,
        isDefault: 'FALSE',
        available: 'TRUE',
        maxQuantity: 2,
        itemOrder: 0,
      },
    ]);
    this.styleHeader(sheet2);
    this.formatDataRows(sheet2, [10]);

    // Sheet 3: Mẫu Định tuyến máy in
    const sheet3 = workbook.addWorksheet('Định tuyến máy in trạm bếp', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet3.columns = [
      { header: 'Mã món (*)', key: 'itemCode', width: 14 },
      { header: 'Tên món ăn', key: 'productName', width: 26 },
      { header: 'Chi nhánh (*)', key: 'branchName', width: 22 },
      { header: 'Trạm bếp / Quầy bar (*)', key: 'stationName', width: 25 },
      { header: 'Vai trò in', key: 'routeRole', width: 16 },
      { header: 'Loại phiếu in', key: 'printType', width: 18 },
      { header: 'Số liên in', key: 'copies', width: 12 },
      { header: 'Đang kích hoạt', key: 'isActive', width: 14 },
    ];
    sheet3.addRows([
      {
        itemCode: 'MAU-001',
        productName: 'Cơm Chiên Cá Hồi Nauy',
        branchName: defaultBranch,
        stationName: defaultStation,
        routeRole: 'PREPARATION',
        printType: 'KITCHEN_TICKET',
        copies: 1,
        isActive: 'TRUE',
      },
      {
        itemCode: 'MAU-002',
        productName: 'Trà Đào Cam Sả Hoàng Gia',
        branchName: defaultBranch,
        stationName: stations.find((s) => s.code === 'BAR')?.name || 'Quầy Bar',
        routeRole: 'PREPARATION',
        printType: 'BEVERAGE_TICKET',
        copies: 1,
        isActive: 'TRUE',
      },
    ]);
    this.styleHeader(sheet3);

    // Sheet 4: Tra cứu
    const sheet4 = workbook.addWorksheet('Danh mục & Chi nhánh (Tra cứu)');
    sheet4.columns = [
      { header: 'DANH MỤC CÓ SẴN', key: 'catCol', width: 28 },
      { header: '', key: 'blank1', width: 4 },
      { header: 'CHI NHÁNH CÓ SẴN', key: 'branchCol', width: 32 },
      { header: 'MÃ CN', key: 'branchCodeCol', width: 12 },
      { header: '', key: 'blank2', width: 4 },
      { header: 'TRẠM BẾP / BAR THEO CHI NHÁNH', key: 'stationCol', width: 30 },
      { header: 'MÃ TRẠM', key: 'stationCodeCol', width: 16 },
      { header: 'CHI NHÁNH', key: 'stationBranchCol', width: 20 },
    ];
    const maxRows = Math.max(categories.length, branches.length, stations.length);
    for (let i = 0; i < maxRows; i++) {
      const cat = categories[i];
      const br = branches[i];
      const st = stations[i];
      sheet4.addRow({
        catCol: cat ? cat.name : '',
        blank1: '',
        branchCol: br ? br.name : '',
        branchCodeCol: br ? br.branchCode || '' : '',
        blank2: '',
        stationCol: st ? st.name : '',
        stationCodeCol: st ? st.code : '',
        stationBranchCol: st ? st.branch?.name || st.branch?.branchCode || '' : '',
      });
    }
    this.styleHeader(sheet4);

    // Sheet 5: Hướng dẫn
    const sheet5 = workbook.addWorksheet('Hướng dẫn sử dụng');
    sheet5.columns = [{ header: 'Nội dung hướng dẫn', key: 'guide', width: 90 }];
    sheet5.addRows([
      { guide: 'HƯỚNG DẪN NHẬP DỮ LIỆU TỪ FILE MẪU' },
      { guide: '1. Bạn có thể xóa các dòng ví dụ (MAU-001, MAU-002, MAU-003) và thêm các dòng dữ liệu thật của quán.' },
      { guide: '2. Các cột có dấu (*) là bắt buộc.' },
      { guide: '3. Giá trị logic: Sử dụng TRUE hoặc FALSE để chỉnh sửa dễ dàng (Trạng thái bán, Bán chạy, AI Gợi ý, Cho phép đổi điểm, TEM_LABEL...).' },
      { guide: '4. Cấu hình máy in bếp & tem nhãn nhanh (Sheet 1):' },
      { guide: '   - "MÁY IN BẾP & CHẾ BIẾN KITCHEN": Điền tên trạm hoặc mã trạm bếp (ví dụ: Bếp Nóng & Món Chính, Quầy Bar, Bếp Bánh...).' },
      { guide: '   - "SỐ LIÊN IN BẾP": Số phiếu cần in khi có đơn (mặc định 1).' },
      { guide: '   - "TEM_LABEL (IN TEM NHÃN)": Điền TRUE nếu muốn in tem dán lên ly/hộp (ví dụ đồ uống mang đi, trà sữa), FALSE nếu không in.' },
      { guide: '   - "SỐ LIÊN IN TEM": Số tem dán cần in (mặc định 1).' },
      { guide: '5. Khi tải lên, hệ thống sẽ tự động cập nhật nếu mã món đã tồn tại hoặc tạo mới nếu mã chưa có.' },
    ]);
    sheet5.getRow(1).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet5.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${this.BRAND_PRIMARY}` } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Đọc và nhập dữ liệu từ file Excel tải lên (Hỗ trợ UPSERT và REPLACE)
   */
  async importProductsFromExcel(
    fileBuffer: Buffer,
    mode: 'UPSERT' | 'REPLACE' = 'UPSERT',
  ): Promise<ImportResultSummary> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (err: any) {
      throw new BadRequestException('File không hợp lệ hoặc không phải định dạng Excel (.xlsx)');
    }

    const summary: ImportResultSummary = {
      totalProcessed: 0,
      createdCount: 0,
      updatedCount: 0,
      optionGroupsSynced: 0,
      optionItemsSynced: 0,
      printRoutesSynced: 0,
      deactivatedCount: 0,
      warnings: [],
      errors: [],
    };

    // Tìm sheet danh sách món ăn
    const sheet1 =
      workbook.getWorksheet('Danh sách món ăn') ||
      workbook.getWorksheet('Sheet1') ||
      workbook.worksheets[0];

    if (!sheet1 || sheet1.rowCount <= 1) {
      throw new BadRequestException('Không tìm thấy dữ liệu trong trang "Danh sách món ăn"!');
    }

    // Đọc header hàng 1 để map cột
    const headerMap: Record<string, number> = {};
    const headerRow = sheet1.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const text = this.normalizeHeader(cell.text);
      if (text) headerMap[text] = colNumber;
    });

    // Lấy dữ liệu danh mục, chi nhánh, trạm bếp từ DB để cache lookup
    const [allCategories, allBranches, allStations] = await Promise.all([
      this.prisma.category.findMany(),
      this.prisma.branch.findMany(),
      this.prisma.kitchenStation.findMany({ include: { branch: true } }),
    ]);

    const catMap = new Map<string, string>(); // name/slug -> id
    allCategories.forEach((c) => {
      catMap.set(c.name.trim().toLowerCase(), c.id);
      catMap.set(c.slug.trim().toLowerCase(), c.id);
    });

    const branchMap = new Map<string, string>(); // name/code -> id
    allBranches.forEach((b) => {
      branchMap.set(b.name.trim().toLowerCase(), b.id);
      if (b.branchCode) branchMap.set(b.branchCode.trim().toLowerCase(), b.id);
    });

    // Lưu danh sách itemCode đã xử lý
    const processedItemCodes = new Set<string>();
    const productMapByCode = new Map<string, string>(); // itemCode -> productId

    // ===================================================
    // BƯỚC 1: Xử lý Sheet 1 - Sản phẩm chính
    // ===================================================
    for (let r = 2; r <= sheet1.rowCount; r++) {
      const row = sheet1.getRow(r);
      const name = this.getCellValue(row, headerMap, ['tên món ăn', 'ten mon an', 'tên món', 'name']);
      if (!name) continue; // Dòng trống hoặc không có tên món

      summary.totalProcessed++;
      let itemCode = this.getCellValue(row, headerMap, ['mã món', 'ma mon', 'code', 'itemcode']);
      if (!itemCode) {
        itemCode = `PRD-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;
        summary.warnings.push(`Dòng ${r}: Món "${name}" không có mã món, tự động sinh mã "${itemCode}".`);
      }
      itemCode = itemCode.trim();

      const priceRaw = this.getCellValue(row, headerMap, ['giá bán', 'gia ban', 'price']);
      const price = this.parseNumber(priceRaw, 0);
      if (price <= 0) {
        summary.errors.push({
          row: r,
          sheet: 'Danh sách món ăn',
          message: `Món "${name}" (mã: ${itemCode}) có giá bán không hợp lệ: "${priceRaw}".`,
        });
        continue;
      }

      const oldPriceRaw = this.getCellValue(row, headerMap, ['giá gốc', 'gia goc', 'oldprice']);
      const oldPrice = oldPriceRaw ? this.parseNumber(oldPriceRaw) : null;

      const discountedPriceRaw = this.getCellValue(row, headerMap, ['giá khuyến mãi', 'gia khuyen mai', 'discountedprice']);
      const discountedPrice = discountedPriceRaw ? this.parseNumber(discountedPriceRaw) : null;

      const unit = this.getCellValue(row, headerMap, ['đơn vị tính', 'don vi tinh', 'unit']) || 'phần';
      const taxPercentage = this.parseNumber(this.getCellValue(row, headerMap, ['thuế vat', 'vat', 'taxpercentage']), 0);
      const description = this.getCellValue(row, headerMap, ['mô tả', 'mo ta', 'description']) || null;
      const imageUrl = this.getCellValue(row, headerMap, ['link ảnh', 'anh', 'imageurl']) || null;

      const availableStr = this.getCellValue(row, headerMap, ['trạng thái', 'trang thai', 'available']);
      const available = this.parseBoolean(availableStr, true);

      const isBestSeller = this.parseBoolean(this.getCellValue(row, headerMap, ['bán chạy', 'ban chay', 'isbestseller']), false);
      const isAiRecommended = this.parseBoolean(this.getCellValue(row, headerMap, ['ai gợi ý', 'ai', 'isairecommended']), false);
      const spiciness = Math.min(3, Math.max(0, this.parseNumber(this.getCellValue(row, headerMap, ['độ cay', 'do cay', 'spiciness']), 0)));
      const targetAudience = this.getCellValue(row, headerMap, ['đối tượng', 'doi tuong', 'targetaudience']) || 'Mọi lứa tuổi';
      const badge = this.getCellValue(row, headerMap, ['huy hiệu', 'huy hieu', 'badge']) || null;

      // Cơ chế tích điểm & đổi điểm
      const isRedeemable = this.parseBoolean(this.getCellValue(row, headerMap, ['cho phép đổi điểm', 'doi diem', 'isredeemable']), false);
      const redemptionPointsRaw = this.getCellValue(row, headerMap, ['số điểm đổi món', 'diem doi', 'redemptionpoints']);
      const redemptionPoints = isRedeemable && redemptionPointsRaw ? this.parseNumber(redemptionPointsRaw) : null;

      // Tìm hoặc tạo Danh mục
      const categoryName = this.getCellValue(row, headerMap, ['danh mục', 'danh muc', 'category']) || 'Món Nóng & Bếp';
      let categoryId = catMap.get(categoryName.trim().toLowerCase());
      if (!categoryId) {
        // Tự động tạo danh mục mới nếu chưa có
        const newCatSlug = this.generateSlug(categoryName);
        const createdCat = await this.prisma.category.create({
          data: {
            name: categoryName.trim(),
            slug: `${newCatSlug}-${Date.now().toString().slice(-4)}`,
            displayOrder: allCategories.length + 1,
          },
        });
        categoryId = createdCat.id;
        catMap.set(categoryName.trim().toLowerCase(), categoryId);
        catMap.set(createdCat.slug.toLowerCase(), categoryId);
        allCategories.push(createdCat);
        summary.warnings.push(`Tự động tạo danh mục mới "${categoryName}".`);
      }

      // Chi nhánh
      const branchesStr = this.getCellValue(row, headerMap, ['chi nhánh', 'chi nhanh', 'branches']);
      let branchConnect: { id: string }[] = [];
      if (!branchesStr || branchesStr.toLowerCase().includes('tất cả') || branchesStr.toLowerCase().includes('all')) {
        branchConnect = allBranches.map((b) => ({ id: b.id }));
      } else {
        const branchParts = branchesStr.split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        branchParts.forEach((part) => {
          const bId = branchMap.get(part);
          if (bId) branchConnect.push({ id: bId });
        });
        if (branchConnect.length === 0) {
          branchConnect = allBranches.map((b) => ({ id: b.id }));
        }
      }

      // Kênh bán hàng
      const salesChannelsRaw = this.getCellValue(row, headerMap, ['kênh bán hàng', 'kenh ban hang', 'channels', 'saleschannels']);
      let salesChannels: string[] = ['DINE_IN', 'TAKEAWAY', 'ONLINE_DELIVERY', 'GRAB_FOOD', 'SHOPEE_FOOD', 'QR_ORDER'];
      if (salesChannelsRaw && !salesChannelsRaw.toLowerCase().includes('tất cả') && !salesChannelsRaw.toLowerCase().includes('all')) {
        const parsedChannels = salesChannelsRaw
          .split(/[,;\n]+/)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => ['DINE_IN', 'TAKEAWAY', 'ONLINE_DELIVERY', 'GRAB_FOOD', 'SHOPEE_FOOD', 'QR_ORDER'].includes(s));
        if (parsedChannels.length > 0) salesChannels = parsedChannels;
      }

      // Link video review & Ảnh phụ
      const videoUrl = this.getCellValue(row, headerMap, ['video review', 'link video', 'videourl', 'video']) || null;
      const secondaryImgsRaw = this.getCellValue(row, headerMap, ['ảnh phụ', 'anh phu', 'gallery', 'secondaryimages']);
      const secondaryImages: string[] = secondaryImgsRaw
        ? secondaryImgsRaw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
        : [];

      // Chi nhánh đổi điểm
      const redeemBranchesStr = this.getCellValue(row, headerMap, ['chi nhánh đổi điểm', 'chi nhanh doi diem', 'redeembranches']);
      let redeemAllBranches = true;
      let redeemBranchConnect: { id: string }[] = [];
      if (redeemBranchesStr && !redeemBranchesStr.toLowerCase().includes('tất cả') && !redeemBranchesStr.toLowerCase().includes('all')) {
        redeemAllBranches = false;
        const parts = redeemBranchesStr.split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        parts.forEach((part) => {
          const bId = branchMap.get(part);
          if (bId) redeemBranchConnect.push({ id: bId });
        });
      }

      // Kiểm tra món đã tồn tại theo itemCode hay chưa
      const existingProduct = await this.prisma.product.findUnique({
        where: { itemCode },
      });

      if (existingProduct) {
        // Cập nhật sản phẩm
        const updated = await this.prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            name,
            categoryId,
            price,
            oldPrice,
            discountedPrice,
            unit,
            taxPercentage,
            salesChannels,
            description,
            imageUrl,
            videoUrl,
            secondaryImages,
            available,
            isBestSeller,
            isAiRecommended,
            spiciness,
            targetAudience,
            badge,
            isRedeemable,
            redemptionPoints,
            redeemAllBranches,
            redeemableBranches: { set: redeemBranchConnect },
            branches: { set: branchConnect },
          },
        });
        productMapByCode.set(itemCode, updated.id);
        processedItemCodes.add(itemCode);
        summary.updatedCount++;
      } else {
        // Tạo mới sản phẩm
        const slugBase = this.generateSlug(name);
        const slug = `${slugBase}-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
        const created = await this.prisma.product.create({
          data: {
            itemCode,
            name,
            slug,
            categoryId,
            price,
            oldPrice,
            discountedPrice,
            unit,
            taxPercentage,
            salesChannels,
            description,
            imageUrl,
            videoUrl,
            secondaryImages,
            available,
            isBestSeller,
            isAiRecommended,
            spiciness,
            targetAudience,
            badge,
            isRedeemable,
            redemptionPoints,
            redeemAllBranches,
            redeemableBranches: { connect: redeemBranchConnect },
            branches: { connect: branchConnect },
          },
        });
        productMapByCode.set(itemCode, created.id);
        processedItemCodes.add(itemCode);
        summary.createdCount++;
      }

      // =========================================================
      // Xử lý Cấu hình Máy in bếp & Tem nhãn trực tiếp từ Sheet 1
      // =========================================================
      const kitchenStationStr = this.getCellValue(row, headerMap, [
        'máy in bếp', 'may in bep', 'chế biến kitchen', 'kitchen', 'trạm bếp', 'tram bep', 'máy in'
      ]);
      const kitchenCopies = this.parseNumber(this.getCellValue(row, headerMap, ['số liên in bếp', 'so lien in bep', 'kitchencopies']), 1);

      const temLabelStr = this.getCellValue(row, headerMap, [
        'tem_label', 'tem label', 'in tem nhãn', 'in tem', 'tem nhan', 'sticker'
      ]);
      const hasTemLabel = temLabelStr !== '' ? this.parseBoolean(temLabelStr, false) : undefined;
      const labelCopies = this.parseNumber(this.getCellValue(row, headerMap, ['số liên in tem', 'so lien in tem', 'labelcopies']), 1);

      const targetProductId = existingProduct ? existingProduct.id : productMapByCode.get(itemCode);

      if (targetProductId) {
        const targetBranches = branchConnect.length > 0 ? branchConnect : allBranches;

        // 1. Cấu hình máy in bếp / chế biến
        if (kitchenStationStr) {
          for (const bRef of targetBranches) {
            const branchStations = allStations.filter((s) => s.branchId === bRef.id);
            const matchedStation = branchStations.find(
              (s) =>
                s.name.trim().toLowerCase() === kitchenStationStr.trim().toLowerCase() ||
                s.code.trim().toLowerCase() === kitchenStationStr.trim().toLowerCase() ||
                s.name.trim().toLowerCase().includes(kitchenStationStr.trim().toLowerCase()) ||
                kitchenStationStr.trim().toLowerCase().includes(s.name.trim().toLowerCase())
            );

            if (matchedStation) {
              const printType = PrintTemplateType.KITCHEN_TICKET;
              await this.prisma.productPrintRoute.deleteMany({
                where: {
                  productId: targetProductId,
                  branchId: bRef.id,
                  routeRole: PrintRouteRole.PREPARATION,
                  printType: PrintTemplateType.KITCHEN_TICKET,
                },
              });

              await this.prisma.productPrintRoute.create({
                data: {
                  productId: targetProductId,
                  branchId: bRef.id,
                  stationId: matchedStation.id,
                  routeRole: PrintRouteRole.PREPARATION,
                  printType,
                  copies: kitchenCopies || 1,
                  isActive: true,
                },
              });
              summary.printRoutesSynced++;
            }
          }
        }

        // 2. Cấu hình Tem nhãn (TEM_LABEL / ITEM_LABEL)
        if (hasTemLabel === true) {
          for (const bRef of targetBranches) {
            const branchStations = allStations.filter((s) => s.branchId === bRef.id);
            const labelStation =
              branchStations.find((s) => s.code === 'BAR' || s.code === 'HOT_KITCHEN') ||
              branchStations[0];

            if (labelStation) {
              await this.prisma.productPrintRoute.deleteMany({
                where: {
                  productId: targetProductId,
                  branchId: bRef.id,
                  printType: PrintTemplateType.ITEM_LABEL,
                },
              });

              await this.prisma.productPrintRoute.create({
                data: {
                  productId: targetProductId,
                  branchId: bRef.id,
                  stationId: labelStation.id,
                  routeRole: PrintRouteRole.LABEL,
                  printType: PrintTemplateType.ITEM_LABEL,
                  copies: labelCopies || 1,
                  isActive: true,
                },
              });
              summary.printRoutesSynced++;
            }
          }
        } else if (hasTemLabel === false) {
          // Bỏ in tem nhãn
          await this.prisma.productPrintRoute.deleteMany({
            where: {
              productId: targetProductId,
              printType: PrintTemplateType.ITEM_LABEL,
            },
          });
        }
      }
    }

    // ===================================================
    // BƯỚC 2: Xử lý Sheet 2 - Nhóm tùy chọn & Topping (nếu có)
    // ===================================================
    const sheet2 =
      workbook.getWorksheet('Nhóm tùy chọn & Topping') ||
      workbook.getWorksheet('Sheet2') ||
      workbook.worksheets[1];

    if (sheet2 && sheet2.rowCount > 1) {
      const h2Map: Record<string, number> = {};
      sheet2.getRow(1).eachCell((cell, colNumber) => {
        const text = this.normalizeHeader(cell.text);
        if (text) h2Map[text] = colNumber;
      });

      // Nhóm dòng theo itemCode -> groupName -> optionItems
      interface RawOptionItem {
        name: string;
        priceAdjustment: number;
        isDefault: boolean;
        available: boolean;
        maxQuantity: number;
        itemOrder: number;
      }
      interface RawOptionGroup {
        name: string;
        isRequired: boolean;
        multipleChoice: boolean;
        minSelect: number;
        maxSelect: number;
        groupOrder: number;
        items: RawOptionItem[];
      }

      const productOptionsMap = new Map<string, Map<string, RawOptionGroup>>();

      for (let r = 2; r <= sheet2.rowCount; r++) {
        const row = sheet2.getRow(r);
        const itemCode = this.getCellValue(row, h2Map, ['mã món', 'ma mon', 'code', 'itemcode']);
        const groupName = this.getCellValue(row, h2Map, ['tên nhóm tùy chọn', 'ten nhom', 'nhóm', 'groupname']);
        const optionName = this.getCellValue(row, h2Map, ['tên lựa chọn', 'topping', 'optionitemname', 'name']);

        if (!itemCode || !groupName || !optionName) continue;

        const isRequired = this.parseBoolean(this.getCellValue(row, h2Map, ['bắt buộc', 'bat buoc', 'isrequired']), false);
        const multipleChoice = this.parseBoolean(this.getCellValue(row, h2Map, ['chọn nhiều', 'chon nhieu', 'multiplechoice']), false);
        const minSelect = this.parseNumber(this.getCellValue(row, h2Map, ['chọn tối thiểu', 'minselect']), 0);
        const maxSelect = this.parseNumber(this.getCellValue(row, h2Map, ['chọn tối đa', 'maxselect']), 1);
        const groupOrder = this.parseNumber(this.getCellValue(row, h2Map, ['thứ tự nhóm', 'grouporder']), 0);

        const priceAdjustment = this.parseNumber(this.getCellValue(row, h2Map, ['giá cộng thêm', 'gia them', 'priceadjustment']), 0);
        const isDefault = this.parseBoolean(this.getCellValue(row, h2Map, ['mặc định', 'mac dinh', 'isdefault']), false);
        const available = this.parseBoolean(this.getCellValue(row, h2Map, ['còn hàng', 'con hang', 'available']), true);
        const maxQuantity = this.parseNumber(this.getCellValue(row, h2Map, ['số lượng tối đa', 'maxquantity']), 1);
        const itemOrder = this.parseNumber(this.getCellValue(row, h2Map, ['thứ tự lựa chọn', 'itemorder']), 0);

        if (!productOptionsMap.has(itemCode)) {
          productOptionsMap.set(itemCode, new Map());
        }
        const groupsMap = productOptionsMap.get(itemCode)!;
        if (!groupsMap.has(groupName)) {
          groupsMap.set(groupName, {
            name: groupName,
            isRequired,
            multipleChoice,
            minSelect,
            maxSelect,
            groupOrder,
            items: [],
          });
        }
        groupsMap.get(groupName)!.items.push({
          name: optionName,
          priceAdjustment,
          isDefault,
          available,
          maxQuantity,
          itemOrder,
        });
      }

      // Thực hiện lưu Option Groups cho từng Product
      for (const [code, groups] of productOptionsMap.entries()) {
        let productId = productMapByCode.get(code);
        if (!productId) {
          const existing = await this.prisma.product.findUnique({ where: { itemCode: code } });
          if (existing) {
            productId = existing.id;
            productMapByCode.set(code, productId);
          }
        }
        if (!productId) continue;

        // Xóa option cũ của món và ghi đè mới để đồng bộ sạch sẽ
        await this.prisma.optionGroup.deleteMany({
          where: { productId },
        });

        for (const [gName, groupData] of groups.entries()) {
          const createdGroup = await this.prisma.optionGroup.create({
            data: {
              productId,
              name: groupData.name,
              isRequired: groupData.isRequired,
              multipleChoice: groupData.multipleChoice,
              minSelect: groupData.minSelect,
              maxSelect: groupData.maxSelect,
              displayOrder: groupData.groupOrder,
              optionItems: {
                create: groupData.items.map((item) => ({
                  name: item.name,
                  priceAdjustment: item.priceAdjustment,
                  isDefault: item.isDefault,
                  available: item.available,
                  maxQuantity: item.maxQuantity,
                  displayOrder: item.itemOrder,
                })),
              },
            },
          });
          summary.optionGroupsSynced++;
          summary.optionItemsSynced += groupData.items.length;
        }
      }
    }

    // ===================================================
    // BƯỚC 3: Xử lý Sheet 3 - Định tuyến máy in trạm bếp (nếu có)
    // ===================================================
    const sheet3 =
      workbook.getWorksheet('Định tuyến máy in trạm bếp') ||
      workbook.getWorksheet('Sheet3') ||
      workbook.worksheets[2];

    if (sheet3 && sheet3.rowCount > 1) {
      const h3Map: Record<string, number> = {};
      sheet3.getRow(1).eachCell((cell, colNumber) => {
        const text = this.normalizeHeader(cell.text);
        if (text) h3Map[text] = colNumber;
      });

      for (let r = 2; r <= sheet3.rowCount; r++) {
        const row = sheet3.getRow(r);
        const itemCode = this.getCellValue(row, h3Map, ['mã món', 'ma mon', 'code', 'itemcode']);
        const branchStr = this.getCellValue(row, h3Map, ['chi nhánh', 'chi nhanh', 'branch']);
        const stationStr = this.getCellValue(row, h3Map, ['trạm bếp', 'tram bep', 'station']);

        if (!itemCode || !branchStr || !stationStr) continue;

        let productId = productMapByCode.get(itemCode);
        if (!productId) {
          const existing = await this.prisma.product.findUnique({ where: { itemCode } });
          if (existing) {
            productId = existing.id;
            productMapByCode.set(itemCode, productId);
          }
        }
        if (!productId) continue;

        // Khớp branch
        const branchId = branchMap.get(branchStr.trim().toLowerCase());
        if (!branchId) continue;

        // Khớp station trong branch này
        const matchedStation = allStations.find(
          (s) =>
            s.branchId === branchId &&
            (s.name.trim().toLowerCase() === stationStr.trim().toLowerCase() ||
              s.code.trim().toLowerCase() === stationStr.trim().toLowerCase()),
        );
        if (!matchedStation) continue;

        const roleRaw = this.getCellValue(row, h3Map, ['vai trò', 'vai tro', 'routerole']) || 'PREPARATION';
        const typeRaw = this.getCellValue(row, h3Map, ['loại phiếu', 'loai phieu', 'printtype']) || 'KITCHEN_TICKET';
        const copies = this.parseNumber(this.getCellValue(row, h3Map, ['số liên', 'so lien', 'copies']), 1);
        const isActive = this.parseBoolean(this.getCellValue(row, h3Map, ['kích hoạt', 'kich hoat', 'isactive']), true);

        // Map enum
        const routeRole: PrintRouteRole = Object.values(PrintRouteRole).includes(roleRaw as any)
          ? (roleRaw as PrintRouteRole)
          : PrintRouteRole.PREPARATION;
        const printType: PrintTemplateType = Object.values(PrintTemplateType).includes(typeRaw as any)
          ? (typeRaw as PrintTemplateType)
          : PrintTemplateType.KITCHEN_TICKET;

        // Xóa route cũ của cặp (product, branch, station) nếu có và tạo mới
        await this.prisma.productPrintRoute.deleteMany({
          where: { productId, branchId, stationId: matchedStation.id },
        });

        await this.prisma.productPrintRoute.create({
          data: {
            productId,
            branchId,
            stationId: matchedStation.id,
            routeRole,
            printType,
            copies,
            isActive,
          },
        });
        summary.printRoutesSynced++;
      }
    }

    // ===================================================
    // BƯỚC 4: Chế độ REPLACE (Tạm ngưng các món không nằm trong file)
    // ===================================================
    if (mode === 'REPLACE' && processedItemCodes.size > 0) {
      const deactResult = await this.prisma.product.updateMany({
        where: {
          itemCode: { notIn: Array.from(processedItemCodes) },
          available: true,
        },
        data: { available: false },
      });
      summary.deactivatedCount = deactResult.count;
      if (deactResult.count > 0) {
        summary.warnings.push(
          `Chế độ REPLACE: Đã chuyển trạng thái Tạm ngưng bán cho ${deactResult.count} món không nằm trong file tải lên.`,
        );
      }
    }

    return summary;
  }

  // =========================================================================
  // HELPER STYLING & PARSING METHODS
  // =========================================================================

  private styleHeader(sheet: ExcelJS.Worksheet) {
    const headerRow = sheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${this.BRAND_PRIMARY}` },
      };
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'medium', color: { argb: 'FF450A0A' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
  }

  private formatDataRows(sheet: ExcelJS.Worksheet, currencyCols: number[]) {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 24;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9.5 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (currencyCols.includes(colNumber) && typeof cell.value === 'number') {
          cell.numFmt = '#,##0 "đ"';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
      // Alternating zebra row
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          if (!cell.fill || (cell.fill as any).type !== 'pattern') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          }
        });
      }
    });
  }

  private normalizeHeader(text: string): string {
    if (!text) return '';
    return text
      .trim()
      .toLowerCase()
      .replace(/\(\*\)/g, '')
      .replace(/\(vnđ\)/g, '')
      .replace(/\(%\)/g, '')
      .replace(/\(0-3\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getCellValue(row: ExcelJS.Row, headerMap: Record<string, number>, keys: string[]): string {
    // 1. Exact match
    for (const key of keys) {
      const col = headerMap[key];
      if (col !== undefined) {
        const val = row.getCell(col).value;
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && 'text' in val) return (val as any).text.trim();
          return String(val).trim();
        }
      }
    }
    // 2. Substring match
    const headerEntries = Object.entries(headerMap);
    for (const key of keys) {
      const found = headerEntries.find(([h]) => h.includes(key) || key.includes(h));
      if (found) {
        const col = found[1];
        const val = row.getCell(col).value;
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && 'text' in val) return (val as any).text.trim();
          return String(val).trim();
        }
      }
    }
    return '';
  }

  private parseNumber(val: any, fallback: number = 0): number {
    if (val === null || val === undefined || val === '') return fallback;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? fallback : num;
  }

  private parseBoolean(val: any, fallback: boolean = false): boolean {
    if (val === null || val === undefined || val === '') return fallback;
    if (typeof val === 'boolean') return val;
    const str = String(val).trim().toLowerCase();
    if (['có', 'co', 'yes', 'true', '1', 'đang bán', 'dang ban', 'bật', 'bat'].includes(str)) return true;
    if (['không', 'khong', 'no', 'false', '0', 'tạm ngưng', 'tam ngung', 'tắt', 'tat'].includes(str)) return false;
    return fallback;
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }
}
