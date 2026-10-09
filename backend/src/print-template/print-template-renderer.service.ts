import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrintTemplateType } from '@prisma/client';
import { PrintTemplateSanitizerService } from './print-template-sanitizer.service';
import { PrintTemplateTagsService } from './print-template-tags.service';

export interface RenderItemData {
  name: string;
  itemCode?: string;
  quantity: number;
  unit?: string;
  priceAtSale: number;
  originalPriceAtSale: number;
  discountAmount?: number;
  optionsText?: string;
  note?: string;
  addedBy?: string;
  orderedAt?: string;
  taxAmount?: number;
  taxPercent?: number;
  selectedOptions?: Array<{ nameAtSale: string; priceAdjustmentAtSale: number }>;
}

export interface RenderContext {
  // Cửa hàng & Chi nhánh
  storeName?: string;
  branchName?: string;
  branchCode?: string;
  branchAddress?: string;
  branchPhone?: string;
  storeAddress?: string;
  storePhone?: string;

  // Hóa đơn & Bàn
  orderCode: string;
  createdAt: Date | string;
  completedAt?: Date | string;
  tableName?: string;
  orderTypeStr?: string;
  orderStatusStr?: string;
  orderNote?: string;
  cashierName?: string;
  guestCount?: number;

  // Khách hàng & Thành viên
  customerName?: string;
  customerPhone?: string;
  memberCode?: string;
  membershipTierName?: string;
  currentPoints?: number;
  pointsUsed?: number;
  pointsAwarded?: number;

  // Giao hàng
  deliveryAddress?: string;
  shippingFee?: number;
  shippingDiscount?: number;

  // Món ăn
  items: RenderItemData[];

  // Tài chính & Voucher
  subTotal: number;
  discountAmount: number;
  totalAmount: number;
  discountVoucherCode?: string;
  shippingVoucherCode?: string;
  vatAmount?: number;
  serviceChargeTotal?: number;
  vatPriceMode?: string;
  printedAt?: Date | string;
  discountReason?: string;
  serviceChargeDetails?: Array<{ name: string; amount: number }>;
  discountDetails?: Array<{ label: string; amount: number; discountPercent?: number }>;
  vatPercentStr?: string;

  // Thanh toán
  paymentMethodStr?: string;
  paymentStatusStr?: string;
  transactionRef?: string;
  paymentTime?: Date | string;
  cashReceived?: number;
  cashChange?: number;

  // Ngân hàng / SePay
  bankAccountNo?: string;
  bankAccountName?: string;
  bankName?: string;
  transferContent?: string;
  paymentQrPayload?: string;

  // Hóa đơn VAT
  taxCode?: string;
  companyName?: string;
  companyAddress?: string;
  invoiceEmail?: string;

  // QR / Barcode URLs hoặc text
  websiteUrl?: string;
  orderTrackUrl?: string;
}

@Injectable()
export class PrintTemplateRendererService {
  private readonly logger = new Logger(PrintTemplateRendererService.name);

  constructor(
    private readonly sanitizer: PrintTemplateSanitizerService,
    private readonly tagsService: PrintTemplateTagsService,
  ) {}

  /**
   * Pipeline chính render mẫu in
   */
  async renderTemplate(
    rawTemplate: string,
    context: RenderContext,
    paperSize: string = '80mm',
    settings?: Record<string, any>,
  ): Promise<string> {
    if (!rawTemplate) {
      return '';
    }

    // Giai đoạn 1: Chuẩn bị cờ điều kiện (Conditions)
    const conditionFlags = this.evaluateConditionFlags(context);

    // Giai đoạn 2: Xử lý khối điều kiện {{#if ...}} ... {{/if}}
    let processedHtml = this.processConditionBlocks(rawTemplate, conditionFlags);

    // Giai đoạn 3: Xử lý vòng lặp món {{#items}} ... {{/items}}
    processedHtml = this.processItemLoop(processedHtml, context.items);

    // Giai đoạn 4: Sinh các hình ảnh QR và Barcode inline
    const qrBarcodeMap = await this.generateQrAndBarcodes(context);

    // Giai đoạn 5: Thay thế thẻ dữ liệu chung
    processedHtml = this.replaceGeneralTags(processedHtml, context, qrBarcodeMap);

    // Giai đoạn 6: Lọc sạch HTML bằng Sanitizer
    const sanitizedBody = this.sanitizer.sanitize(processedHtml);

    // Giai đoạn 7: Bọc CSS In nhiệt chuẩn (Thermal Print Wrapper)
    return this.wrapWithThermalPrintCss(sanitizedBody, paperSize, settings);
  }

  /**
   * Tạo Mock Context đầy đủ dữ liệu phong phú để test Preview
   */
  createMockContext(): RenderContext {
    return {
      storeName: 'AVORA RESTAURANT',
      branchName: 'Chi nhánh Quận 1 - Nguyễn Huệ',
      branchCode: 'CN-Q1',
      branchAddress: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      branchPhone: '0901 234 567',
      storeAddress: '123 Nguyễn Huệ, Q.1, TP.HCM',
      storePhone: '1900 6868',

      orderCode: 'AV260905-0012',
      createdAt: new Date(),
      completedAt: new Date(),
      tableName: 'Bàn A-05',
      orderTypeStr: 'Tại bàn (Dine-in)',
      orderStatusStr: 'Đã thanh toán',
      orderNote: 'Giao nhanh trước 20h, bàn sinh nhật',
      cashierName: 'Nguyễn Văn Thu Ngân',
      guestCount: 4,

      customerName: 'Trần Thị Mai',
      customerPhone: '0988 776 655',
      memberCode: 'MEM-88992',
      membershipTierName: 'Hạng Vàng (Gold)',
      currentPoints: 1250,
      pointsUsed: 50,
      pointsAwarded: 45,

      deliveryAddress: '45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM',
      shippingFee: 25000,
      shippingDiscount: 25000,

      items: [
        {
          name: 'Cá hồi Na Uy sốt Teriyaki',
          itemCode: 'CA-HOI-01',
          quantity: 2,
          unit: 'phần',
          priceAtSale: 135000,
          originalPriceAtSale: 150000,
          discountAmount: 30000,
          optionsText: 'Ít cay, Thêm sốt đặc biệt',
          note: 'Làm chín kỹ',
          addedBy: 'Tuấn NV',
          orderedAt: '19:48',
          taxAmount: 20000,
          taxPercent: 8,
        },
        {
          name: 'Bò Wagyu Úc nướng đá lửa',
          itemCode: 'BO-WAGYU-02',
          quantity: 1,
          unit: 'phần',
          priceAtSale: 250000,
          originalPriceAtSale: 250000,
          discountAmount: 0,
          optionsText: 'Medium Rare, Muối hồng',
          note: '',
          addedBy: 'Tuấn NV',
          orderedAt: '19:50',
          taxAmount: 18500,
          taxPercent: 8,
        },
        {
          name: 'Trà hoa cúc mật ong tuyết nhĩ',
          itemCode: 'TRA-CUC-03',
          quantity: 3,
          unit: 'ly',
          priceAtSale: 45000,
          originalPriceAtSale: 45000,
          discountAmount: 0,
          optionsText: 'Ít đá, 50% ngọt',
          note: '',
          addedBy: 'Tuấn NV',
          orderedAt: '19:52',
          taxAmount: 10000,
          taxPercent: 8,
        },
      ],

      subTotal: 655000,
      discountAmount: 50000,
      totalAmount: 605000,
      discountVoucherCode: 'GIAM10',
      shippingVoucherCode: 'FREESHIP',
      vatAmount: 48500,
      serviceChargeTotal: 25000,
      vatPriceMode: 'VAT_EXCLUDED',
      printedAt: new Date(),

      paymentMethodStr: 'Tiền mặt',
      paymentStatusStr: 'Đã thanh toán',
      transactionRef: 'TXN-998822',
      paymentTime: new Date(),
      cashReceived: 700000,
      cashChange: 95000,

      bankAccountNo: '1028889999',
      bankAccountName: 'AVORA RESTAURANT',
      bankName: 'Vietcombank',
      transferContent: 'AV260905 0012',
      paymentQrPayload: '00020101021238540010A0000007270126000697042201121028889999530370454066050005802VN',

      taxCode: '0315888999',
      companyName: 'CÔNG TY TNHH ẨM THỰC AVORA VIỆT NAM',
      companyAddress: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
      invoiceEmail: 'ketoan@avora.vn',

      websiteUrl: 'https://avora.vn',
      orderTrackUrl: 'https://avora.vn/orders/AV260905-0012',
    };
  }

  /**
   * Đánh giá các cờ điều kiện hiển thị thông minh
   * Ẩn khi không có thông tin hoặc giá trị bằng 0
   * Phí giao hàng luôn hiển thị kể cả 0đ theo yêu cầu
   */
  private evaluateConditionFlags(context: RenderContext): Record<string, boolean> {
    const hasDiscountVoucher = Boolean(
      context.discountVoucherCode &&
        context.discountVoucherCode.trim().length > 0 &&
        context.discountAmount &&
        context.discountAmount > 0,
    );
    const hasShippingVoucher = Boolean(
      context.shippingVoucherCode &&
        context.shippingVoucherCode.trim().length > 0 &&
        context.shippingDiscount &&
        context.shippingDiscount > 0,
    );
    const hasDiscount = Boolean(
      (context.discountAmount && context.discountAmount > 0) ||
      (context.shippingDiscount && context.shippingDiscount > 0) ||
      (context.discountDetails && context.discountDetails.length > 0)
    );
    const hasVat = Boolean(context.vatAmount && context.vatAmount > 0);
    const hasServiceCharge = Boolean(
      (context.serviceChargeTotal && context.serviceChargeTotal > 0) ||
      (context.serviceChargeDetails && context.serviceChargeDetails.length > 0)
    );
    const hasShippingFee = Boolean(context.shippingFee && context.shippingFee > 0);

    const isVatInclusive = hasVat && (
      context.vatPriceMode === 'INCLUSIVE' ||
      context.vatPriceMode === 'VAT_INCLUDED'
    );
    const isVatExclusive = hasVat && !isVatInclusive;
    const noVat = !hasVat;

    const hasVatInvoice = Boolean(
      (context.companyName && context.companyName.trim().length > 0) ||
        (context.taxCode && context.taxCode.trim().length > 0),
    );
    const hasCustomer = Boolean(
      (context.customerName && context.customerName.trim().length > 0) ||
        (context.customerPhone && context.customerPhone.trim().length > 0),
    );
    const hasMembership = Boolean(
      (context.membershipTierName && context.membershipTierName.trim().length > 0) ||
        (context.currentPoints && context.currentPoints > 0),
    );
    const hasDeliveryAddress = Boolean(
      context.deliveryAddress && context.deliveryAddress.trim().length > 0,
    );

    return {
      // Voucher & Giảm giá (Chỉ hiển thị khi có mã và số tiền > 0)
      voucher: hasDiscountVoucher || hasShippingVoucher || hasDiscount,
      discountVoucher: hasDiscountVoucher,
      shippingVoucher: hasShippingVoucher,
      discount: hasDiscount,
      hasDiscount,

      // Phụ phí / Phí dịch vụ
      serviceCharge: hasServiceCharge,
      hasServiceCharge,

      // Phí giao hàng
      shipping: true,
      hasShippingFee,
      hasDeliveryAddress,

      // Khách hàng & Thành viên
      customer: hasCustomer,
      membership: hasMembership,

      // Thuế VAT & Hóa đơn đỏ công ty
      vat: hasVat, // Dòng Thuế VAT trong bảng tiền: chỉ hiện khi có tiền thuế > 0
      hasVat,
      hasVatDetail: hasVat,
      vatInclusive: isVatInclusive,
      vatExclusive: isVatExclusive,
      noVat,
      vatInvoice: hasVatInvoice, // Khối xuất HĐ VAT (MST, Tên cty, Email): chỉ hiện khi có MST hoặc Tên cty
      hasServiceChargeDetail: hasServiceCharge,
      hasDiscountDetail: hasDiscount,

      // Phương thức thanh toán
      cashPayment: Boolean(
        context.paymentMethodStr?.toLowerCase().includes('tiền mặt') ||
          (context.cashReceived && context.cashReceived > 0),
      ),
      qrPayment: Boolean(
        context.paymentQrPayload ||
          context.paymentMethodStr?.toLowerCase().includes('chuyển khoản') ||
          context.paymentMethodStr?.toLowerCase().includes('qr') ||
          context.paymentMethodStr?.toLowerCase().includes('sepay'),
      ),
      note: Boolean(context.orderNote && context.orderNote.trim().length > 0),
      table: Boolean(context.tableName && context.tableName.trim().length > 0),
    };
  }

  /**
   * Xử lý khối điều kiện bằng giải thuật innermost-first
   * Hỗ trợ chuẩn xác các điều kiện lồng nhau (nested conditions)
   * Triệt tiêu hoàn toàn lỗi sót lại thẻ đóng {{/if}}
   */
  private processConditionBlocks(html: string, flags: Record<string, boolean>): string {
    // Khớp cặp {{#if cond}}...{{/if}} trong cùng (bên trong không chứa bất kỳ {{#if khác)
    const innermostIfRegex = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;

    let previous: string;
    let result = html;
    let iteration = 0;

    // Lặp giải quyết từ tầng sâu nhất ra ngoài
    do {
      previous = result;
      result = result.replace(innermostIfRegex, (match, conditionName: string, innerContent: string) => {
        const isTruthy = Boolean(flags[conditionName]);
        return isTruthy ? innerContent : '';
      });
      iteration++;
    } while (result !== previous && iteration < 20);

    // Bước dọn dẹp an toàn tuyệt đối: quét sạch mọi thẻ mở/đóng mồ côi (orphan if tags)
    result = result.replace(/\{\{#if\s+[^}]*\}\}/g, '').replace(/\{\{\/if\}\}/g, '');

    return result;
  }

  /**
   * Format chi tiết các tùy chọn (Option) kèm giá gốc món ăn căn thẳng hàng mép phải tuyệt đối
   */
  public formatItemOptionsHtml(it: RenderItemData): string {
    const options: Array<{ name: string; price: number }> = [];

    if (it.selectedOptions && it.selectedOptions.length > 0) {
      for (const opt of it.selectedOptions) {
        options.push({
          name: opt.nameAtSale,
          price: Number(opt.priceAdjustmentAtSale || 0),
        });
      }
    } else if (it.optionsText) {
      const parts = it.optionsText.split(/,\s*/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(.*?)\s*\(\+?([0-9.,]+)\s*(?:đ|vnd)?\)$/i);
        if (match) {
          const rawName = match[1].trim();
          const rawPrice = match[2].replace(/[.,]/g, '');
          options.push({
            name: rawName,
            price: Number(rawPrice) || 0,
          });
        } else {
          options.push({
            name: trimmed,
            price: 0,
          });
        }
      }
    }

    if (options.length === 0) return '';

    const optionTotal = options.reduce((sum, o) => sum + o.price, 0);
    const basePrice = Math.max(0, it.priceAtSale - optionTotal);

    let html = `<table style="width: 100%; border-collapse: collapse; margin-top: 1.5px; font-size: 9px; color: #444;">`;
    html += `<tr><td style="text-align: left; padding: 0.5px 0;">Giá món:</td><td style="text-align: right; padding: 0.5px 0; font-variant-numeric: tabular-nums; white-space: nowrap;">+${this.formatCurrency(basePrice)}</td></tr>`;

    for (const opt of options) {
      html += `<tr><td style="text-align: left; padding: 0.5px 0;">${opt.name}:</td><td style="text-align: right; padding: 0.5px 0; font-variant-numeric: tabular-nums; white-space: nowrap;">+${this.formatCurrency(opt.price)}</td></tr>`;
    }

    html += `</table>`;
    return html;
  }

  /**
   * Xử lý vòng lặp món ăn {{#items}} ... {{/items}}
   */
  private processItemLoop(html: string, items: RenderItemData[]): string {
    const loopRegex = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g;

    let result = html.replace(loopRegex, (match, itemTemplate: string) => {
      if (!items || items.length === 0) {
        return '';
      }

      return items
        .map((it) => {
          let row = itemTemplate;
          const totalItemPrice = it.quantity * it.priceAtSale;

          row = row.replace(/\[Ten_Mon_An\]/g, it.name || '');
          row = row.replace(/\[Ma_Mon\]/g, it.itemCode || '');
          row = row.replace(/\[So_Luong\]/g, String(it.quantity || 1));
          row = row.replace(/\[Don_Vi_Tinh\]/g, it.unit || 'phần');
          row = row.replace(/\[Gia_Goc\]/g, this.formatCurrency(it.originalPriceAtSale || it.priceAtSale));
          row = row.replace(/\[Don_Gia\]/g, this.formatCurrency(it.priceAtSale));
          row = row.replace(/\[Giam_Gia_Mon\]/g, this.formatCurrency(it.discountAmount || 0));
          row = row.replace(
            /\[Tien_Truoc_Thue_Mon\]/g,
            this.formatCurrency(it.priceAtSale - (it.taxAmount || 0)),
          );
          row = row.replace(/\[Thue_Mon\]/g, this.formatCurrency(it.taxAmount || 0));
          row = row.replace(/\[Thanh_Tien\]/g, this.formatCurrency(totalItemPrice));
          row = row.replace(/\[Tuy_Chon_Mon\]/g, this.formatItemOptionsHtml(it));
          row = row.replace(/\[Ghi_Chu_Mon\]/g, it.note ? `* ${it.note}` : '');
          row = row.replace(/\[Nguoi_Them_Mon\]/g, it.addedBy || '');
          row = row.replace(/\[Ngay_Gio_Goi_Mon\]/g, it.orderedAt || '');
          row = row.replace(/\[VAT_Tung_Mon\]/g, this.formatCurrency(it.taxAmount || 0));
          row = row.replace(/\[%_VAT_Tung_Mon\]/g, it.taxPercent ? `${it.taxPercent}%` : '0%');

          return row;
        })
        .join('');
    });

    // Nếu sau khi thay thế {{#items}}, template vẫn còn chứa các thẻ món ăn đơn lẻ (như mẫu ITEM_LABEL không dùng vòng lặp)
    // thì thay thế trực tiếp từ items[0] (nếu có) hoặc để rỗng
    const singleItem = items && items.length > 0 ? items[0] : null;
    const totalItemPrice = singleItem ? (singleItem.quantity || 1) * singleItem.priceAtSale : 0;

    result = result.replace(/\[Ten_Mon_An\]/g, singleItem?.name || '');
    result = result.replace(/\[Ma_Mon\]/g, singleItem?.itemCode || '');
    result = result.replace(/\[So_Luong\]/g, singleItem ? String(singleItem.quantity || 1) : '');
    result = result.replace(/\[Don_Vi_Tinh\]/g, singleItem?.unit || 'phần');
    result = result.replace(
      /\[Gia_Goc\]/g,
      singleItem ? this.formatCurrency(singleItem.originalPriceAtSale || singleItem.priceAtSale) : '',
    );
    result = result.replace(
      /\[Don_Gia\]/g,
      singleItem ? this.formatCurrency(singleItem.priceAtSale) : '',
    );
    result = result.replace(
      /\[Giam_Gia_Mon\]/g,
      singleItem ? this.formatCurrency(singleItem.discountAmount || 0) : '',
    );
    result = result.replace(
      /\[Tien_Truoc_Thue_Mon\]/g,
      singleItem ? this.formatCurrency(singleItem.priceAtSale - (singleItem.taxAmount || 0)) : '',
    );
    result = result.replace(
      /\[Thue_Mon\]/g,
      singleItem ? this.formatCurrency(singleItem.taxAmount || 0) : '',
    );
    result = result.replace(
      /\[Thanh_Tien\]/g,
      singleItem ? this.formatCurrency(totalItemPrice) : '',
    );
    result = result.replace(/\[Tuy_Chon_Mon\]/g, singleItem ? this.formatItemOptionsHtml(singleItem) : '');
    result = result.replace(/\[Ghi_Chu_Mon\]/g, singleItem?.note ? `* ${singleItem.note}` : '');
    result = result.replace(/\[Nguoi_Them_Mon\]/g, singleItem?.addedBy || '');
    result = result.replace(/\[Ngay_Gio_Goi_Mon\]/g, singleItem?.orderedAt || '');
    result = result.replace(
      /\[VAT_Tung_Mon\]/g,
      singleItem ? this.formatCurrency(singleItem.taxAmount || 0) : '',
    );
    result = result.replace(
      /\[%_VAT_Tung_Mon\]/g,
      singleItem ? (singleItem.taxPercent ? `${singleItem.taxPercent}%` : '0%') : '',
    );

    // Tự động dọn dẹp các thẻ div rỗng do Tuy_Chon_Mon hoặc Ghi_Chu_Mon không có dữ liệu
    result = result.replace(/<div[^>]*>\s*<\/div>/gi, '');

    return result;
  }

  /**
   * Sinh ảnh QR Code và Barcode dạng Base64 inline
   */
  private async generateQrAndBarcodes(context: RenderContext): Promise<Record<string, string>> {
    const map: Record<string, string> = {};

    try {
      // 1. QR Website
      const webUrl = context.websiteUrl || 'https://avora.vn';
      const webQr = await QRCode.toDataURL(webUrl, { width: 90, margin: 0 });
      map['[Ma_QR_Website]'] = `<img src="${webQr}" width="90" height="90" alt="QR Website" style="display:inline-block;" />`;

      // 2. QR Đơn hàng
      const orderUrl = context.orderTrackUrl || `https://avora.vn/orders/${context.orderCode}`;
      const orderQr = await QRCode.toDataURL(orderUrl, { width: 90, margin: 0 });
      map['[Ma_QR_Don_Hang]'] = `<img src="${orderQr}" width="90" height="90" alt="QR Order" style="display:inline-block;" />`;

      // 3. QR Thanh toán (SePay / VietQR)
      if (context.paymentQrPayload) {
        if (
          context.paymentQrPayload.startsWith('http://') ||
          context.paymentQrPayload.startsWith('https://') ||
          context.paymentQrPayload.startsWith('data:image')
        ) {
          map['[Ma_QR_Thanh_Toan]'] = `<img src="${context.paymentQrPayload}" width="90" height="90" alt="QR Pay" style="display:inline-block; max-width:90px;" />`;
        } else {
          const payQr = await QRCode.toDataURL(context.paymentQrPayload, { width: 90, margin: 0 });
          map['[Ma_QR_Thanh_Toan]'] = `<img src="${payQr}" width="90" height="90" alt="QR Pay" style="display:inline-block;" />`;
        }
      } else if (context.bankAccountNo && context.totalAmount > 0) {
        const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(context.bankAccountNo)}&bank=${encodeURIComponent(context.bankName || 'OCB')}&amount=${context.totalAmount}&des=${encodeURIComponent(context.transferContent || context.orderCode)}`;
        map['[Ma_QR_Thanh_Toan]'] = `<img src="${qrUrl}" width="90" height="90" alt="QR Pay" style="display:inline-block; max-width:90px;" />`;
      } else {
        map['[Ma_QR_Thanh_Toan]'] = '';
      }

      // 4. Barcode mã đơn hàng (Tạo inline SVG barcode Code128)
      const barcodeSvg = this.generateInlineCode128Svg(context.orderCode || 'AVORA');
      map['[Ma_Vach_Hoa_Don]'] = barcodeSvg;
      map['[Ma_Vach_Barcode]'] = barcodeSvg;
    } catch (err) {
      this.logger.error('Lỗi khi sinh QR/Barcode cho template:', err);
    }

    return map;
  }

  /**
   * Thay thế các thẻ dữ liệu chung
   */
  private replaceGeneralTags(
    html: string,
    context: RenderContext,
    qrBarcodeMap: Record<string, string>,
  ): string {
    let output = html;

    // Thay thế QR/Barcode
    for (const [tag, replacement] of Object.entries(qrBarcodeMap)) {
      output = output.split(tag).join(replacement);
    }

    // 1. Cửa hàng & Chi nhánh
    output = output.replace(/\[Ten_Cua_Hang\]/g, context.storeName || 'AVORA RESTAURANT');
    output = output.replace(/\[Ten_Chi_Nhanh\]/g, context.branchName || 'AVORA Restaurant');
    output = output.replace(/\[Ma_Chi_Nhanh\]/g, context.branchCode || '');
    output = output.replace(/\[Dia_Chi_Chi_Nhanh\]/g, context.branchAddress || '');
    output = output.replace(/\[Dien_Thoai_Chi_Nhanh\]/g, context.branchPhone || '');
    output = output.replace(/\[Dia_Chi_Cua_Hang\]/g, context.storeAddress || context.branchAddress || '');
    output = output.replace(/\[Dien_Thoai_Cua_Hang\]/g, context.storePhone || context.branchPhone || '');

    // 2. Hóa đơn & Bàn
    output = output.replace(/\[Ma_Hoa_Don\]/g, context.orderCode || '');
    output = output.replace(/\[Ngay_Tao\]/g, this.formatDateTime(context.createdAt));
    output = output.replace(/\[Gio_Tao\]/g, this.formatTime(context.createdAt));
    output = output.replace(/\[Ngay_Hoan_Thanh\]/g, this.formatDateTime(context.completedAt || new Date()));
    output = output.replace(/\[Ten_Ban\]/g, context.tableName || 'Mang đi');
    output = output.replace(/\[Loai_Don_Hang\]/g, context.orderTypeStr || 'Tại bàn');
    output = output.replace(/\[Trang_Thai_Don_Hang\]/g, context.orderStatusStr || 'Hoàn tất');
    output = output.replace(/\[Ghi_Chu_Don_Hang\]/g, context.orderNote || '');
    output = output.replace(/\[Ten_Thu_Ngan\]/g, context.cashierName || 'Thu ngân');
    output = output.replace(/\[So_Luong_Khach\]/g, String(context.guestCount || 1));

    // 3. Khách hàng
    output = output.replace(/\[Ten_Khach_Hang\]/g, context.customerName || 'Khách vãng lai');
    output = output.replace(/\[Dien_Thoai_Khach_Hang\]/g, context.customerPhone || '');
    output = output.replace(/\[Ma_Thanh_Vien\]/g, context.memberCode || '');
    output = output.replace(/\[Hang_Thanh_Vien\]/g, context.membershipTierName || 'Thành viên mới');
    output = output.replace(/\[Diem_Hien_Tai\]/g, this.formatNumber(context.currentPoints || 0));
    output = output.replace(/\[Diem_Da_Dung\]/g, this.formatNumber(context.pointsUsed || 0));
    output = output.replace(/\[Diem_Tich_Luy\]/g, this.formatNumber(context.pointsAwarded || 0));
    const customerSummary = context.customerName
      ? `${context.customerName}${context.membershipTierName ? ' (' + context.membershipTierName + ')' : ''}`
      : 'Khách vãng lai';
    output = output.replace(/\[Chi_Tiet_Khach_Hang\]/g, customerSummary);

    // 4. Giao hàng
    output = output.replace(/\[Dia_Chi_Giao_Hang\]/g, context.deliveryAddress || '');
    output = output.replace(/\[Phi_Giao_Hang\]/g, this.formatCurrency(context.shippingFee || 0));
    output = output.replace(/\[Giam_Gia_Van_Chuyen\]/g, this.formatCurrency(context.shippingDiscount || 0));

    // 5. Tài chính & Voucher kép
    const totalItemsQty = context.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    output = output.replace(/\[Tam_Tinh\]/g, this.formatCurrency(context.subTotal));
    output = output.replace(/\[Tong_Tien_Hang\]/g, this.formatCurrency(context.subTotal));
    output = output.replace(
      /\[Tong_Tien_Truoc_Thue\]|\[Tam_Tinh_Truoc_Thue\]|\[TT_Truoc_VAT\]/g,
      this.formatCurrency(context.subTotal - (context.vatAmount || 0)),
    );
    output = output.replace(/\[Tong_So_Luong\]/g, String(totalItemsQty));
    output = output.replace(
      /\[Tong_VAT\]|\[Tien_Thue\]|\[Tien_Thue_VAT\]|\[Tien_VAT\]/g,
      this.formatCurrency(context.vatAmount || 0),
    );
    output = output.replace(/\[Giam_Gia\]/g, this.formatCurrency(context.discountAmount || 0));
    output = output.replace(/\[Tong_Cong\]/g, this.formatCurrency(context.totalAmount));

    output = output.replace(/\[Ma_Voucher_Giam_Gia\]/g, context.discountVoucherCode || '');
    output = output.replace(/\[Ma_Voucher_Freeship\]/g, context.shippingVoucherCode || '');
    output = output.replace(
      /\[Voucher_Giam_Gia\]/g,
      context.discountVoucherCode
        ? `${context.discountVoucherCode} (-${this.formatCurrency(context.discountAmount)})`
        : '',
    );
    output = output.replace(
      /\[Voucher_Freeship\]/g,
      context.shippingVoucherCode
        ? `${context.shippingVoucherCode} (-${this.formatCurrency(context.shippingDiscount || 0)})`
        : '',
    );
    output = output.replace(/\[Tien_Giam_Voucher\]/g, this.formatCurrency(context.discountAmount || 0));
    output = output.replace(
      /\[Tien_Giam_Freeship\]/g,
      this.formatCurrency(context.shippingDiscount || 0),
    );

    // 6. Thanh toán
    output = output.replace(/\[Phuong_Thuc_Thanh_Toan\]/g, context.paymentMethodStr || 'Tiền mặt');
    output = output.replace(/\[Trang_Thai_Thanh_Toan\]/g, context.paymentStatusStr || 'Đã thanh toán');
    output = output.replace(/\[Ma_Giao_Dich\]/g, context.transactionRef || '');
    output = output.replace(
      /\[Thoi_Gian_Thanh_Toan\]/g,
      this.formatDateTime(context.paymentTime || new Date()),
    );
    output = output.replace(/\[Tien_Khach_Tra\]/g, this.formatCurrency(context.cashReceived || context.totalAmount));
    output = output.replace(/\[Tien_Thoi\]/g, this.formatCurrency(context.cashChange || 0));
    output = output.replace(/\[Noi_Dung_Chuyen_Khoan\]/g, context.transferContent || context.orderCode);
    output = output.replace(/\[So_Tai_Khoan\]/g, context.bankAccountNo || '');
    output = output.replace(/\[Ten_Tai_Khoan\]/g, context.bankAccountName || 'AVORA RESTAURANT');
    output = output.replace(/\[Ngan_Hang\]/g, context.bankName || 'Vietcombank');

    // 7. VAT
    output = output.replace(/\[Ma_So_Thue\]/g, context.taxCode || '');
    output = output.replace(/\[Ten_Cong_Ty\]/g, context.companyName || '');
    output = output.replace(/\[Dia_Chi_Cong_Ty\]/g, context.companyAddress || '');
    output = output.replace(/\[Email_Hoa_Don\]/g, context.invoiceEmail || '');
    output = output.replace(
      /\[Che_Do_VAT\]/g,
      context.vatPriceMode === 'INCLUSIVE' || context.vatPriceMode === 'VAT_INCLUDED'
        ? 'Đã bao gồm VAT'
        : 'Chưa bao gồm VAT',
    );

    // 8. Phụ phí & In ấn
    output = output.replace(/\[Gio_In\]/g, this.formatDateTime(context.printedAt || new Date()));
    output = output.replace(/\[Ngay_Gio_In\]/g, this.formatDateTime(context.printedAt || new Date()));
    output = output.replace(/\[Phu_Phi\]/g, this.formatCurrency(context.serviceChargeTotal || 0));
    output = output.replace(/\[Tong_Phu_Phi\]/g, this.formatCurrency(context.serviceChargeTotal || 0));
    output = output.replace(/\[Phi_Dich_Vu\]/g, this.formatCurrency(context.serviceChargeTotal || 0));
    output = output.replace(/\[Ly_Do_Giam_Gia\]/g, context.discountReason || '');
    output = output.replace(/\[Phan_Tram_VAT\]/g, context.vatPercentStr || '8%');

    // 9. Chi tiết dòng phụ phí, giảm giá và VAT
    const scRows = (context.serviceChargeDetails && context.serviceChargeDetails.length > 0)
      ? context.serviceChargeDetails.map((sc) =>
          `<tr><td style="text-align:left;padding:0.5px 0 0.5px 8px;font-size:10.5px;color:#333;">+ ${sc.name}</td><td style="text-align:right;padding:0.5px 0 0.5px 0;font-size:10.5px;color:#333;white-space:nowrap;">+ ${this.formatCurrency(sc.amount)}</td></tr>`
        ).join('')
      : ((context.serviceChargeTotal && context.serviceChargeTotal > 0)
          ? `<tr><td style="text-align:left;padding:0.5px 0 0.5px 8px;font-size:10.5px;color:#333;">+ Phụ thu:</td><td style="text-align:right;padding:0.5px 0 0.5px 0;font-size:10.5px;color:#333;white-space:nowrap;">+ ${this.formatCurrency(context.serviceChargeTotal)}</td></tr>`
          : '');
    output = output.replace(/\[Chi_Tiet_Phu_Phi\]/g, scRows);

    const discountRows = (context.discountDetails && context.discountDetails.length > 0)
      ? context.discountDetails.map((d) => {
          const pctStr = d.discountPercent && d.discountPercent > 0 ? ` (-${d.discountPercent}%)` : '';
          return `<tr><td style="text-align:left;padding:0.5px 0 0.5px 8px;font-size:10.5px;color:#333;">+ ${d.label}${pctStr}</td><td style="text-align:right;padding:0.5px 0 0.5px 0;font-size:10.5px;color:#333;white-space:nowrap;">- ${this.formatCurrency(d.amount)}</td></tr>`;
        }).join('')
      : ((context.discountAmount && context.discountAmount > 0)
          ? `<tr><td style="text-align:left;padding:0.5px 0 0.5px 8px;font-size:10.5px;color:#333;">+ Khuyến mãi:</td><td style="text-align:right;padding:0.5px 0 0.5px 0;font-size:10.5px;color:#333;white-space:nowrap;">- ${this.formatCurrency(context.discountAmount)}</td></tr>`
          : '');
    output = output.replace(/\[Chi_Tiet_Giam_Gia\]/g, discountRows);

    // Tính chi tiết thuế nếu có nhiều mức thuế suất khác nhau trong đơn
    const vatByRate: Record<number, number> = {};
    for (const it of (context.items || [])) {
      if (it.taxAmount && it.taxAmount > 0) {
        const rate = it.taxPercent || 8;
        vatByRate[rate] = (vatByRate[rate] || 0) + it.taxAmount;
      }
    }
    const rateKeys = Object.keys(vatByRate).map(Number);
    let vatRows = '';
    if (rateKeys.length > 1) {
      vatRows = rateKeys.map((rate) =>
        `<tr><td style="text-align:left;padding:0.5px 0 0.5px 8px;font-size:10px;color:#444;">+ VAT ${rate}%:</td><td style="text-align:right;padding:0.5px 0 0.5px 0;font-size:10px;color:#444;white-space:nowrap;">${this.formatCurrency(vatByRate[rate])}</td></tr>`
      ).join('');
    }
    output = output.replace(/\[Chi_Tiet_VAT\]/g, vatRows);

    return output;
  }

  /**
   * Bọc HTML trong môi trường CSS in nhiệt tiêu chuẩn
   */
  private wrapWithThermalPrintCss(
    bodyHtml: string,
    paperSize: string = '80mm',
    settings?: Record<string, any>,
  ): string {
    const isLabel = paperSize === '50x30mm' || paperSize === '30x50mm' || paperSize === '50x70mm';
    const isXP350 = paperSize === 'XP-350B' || paperSize === 'XP350B' || paperSize === '76mm';
    let widthCss = '68mm';
    let pageSizeDirective = '72mm auto';

    switch (paperSize) {
      case '58mm':
        widthCss = '46mm';
        pageSizeDirective = '48mm auto';
        break;
      case 'XP-350B':
      case 'XP350B':
      case '76mm':
        widthCss = '72mm';
        pageSizeDirective = '76mm auto';
        break;
      case '50x30mm':
      case '30x50mm':
        widthCss = '50mm';
        pageSizeDirective = '50mm 30mm';
        break;
      case '50x70mm':
        widthCss = '70mm';
        pageSizeDirective = '70mm 50mm';
        break;
      case 'A5':
        widthCss = '148mm';
        pageSizeDirective = 'A5 portrait';
        break;
      case 'A4':
        widthCss = '210mm';
        pageSizeDirective = 'A4 portrait';
        break;
      case 'CUSTOM':
        if (settings?.widthMm) {
          const heightPart = settings?.heightMm ? `${settings.heightMm}mm` : 'auto';
          widthCss = `${settings.widthMm}mm`;
          pageSizeDirective = `${settings.widthMm}mm ${heightPart}`;
        }
        break;
      default:
        widthCss = '70mm';
        pageSizeDirective = '72mm auto';
        break;
    }

    const containerPadding = isLabel ? '3mm 3.5mm 1.5mm 2.5mm' : isXP350 ? '1mm 1mm 1.5mm 1mm' : '2px 1.5mm';
    const baseFontSize = isLabel ? '10px' : isXP350 ? '11px' : '11.5px';
    const baseLineHeight = isLabel ? '1.15' : '1.3';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bản in AVORA</title>
  <style>
    @page {
      size: ${pageSizeDirective};
      margin: 0mm !important;
    }
    @page :left {
      margin: 0mm !important;
    }
    @page :right {
      margin: 0mm !important;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff;
      color: #000000;
      font-family: ${settings?.fontFamily || "'Helvetica Neue', Arial, sans-serif"};
      font-size: ${settings?.fontSize ? `${settings.fontSize}px` : baseFontSize};
      line-height: ${baseLineHeight};
      font-weight: ${settings?.fontWeight || 'normal'};
      height: auto !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }
    .print-container {
      width: ${widthCss};
      max-width: ${widthCss};
      margin: 0 auto;
      padding: ${containerPadding};
      background: #ffffff;
      box-sizing: border-box;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-before: avoid !important;
      break-before: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      overflow: hidden !important;
      ${isLabel ? 'overflow: hidden;' : ''}
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
      box-sizing: border-box;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    tr, td, th {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td {
      color: #000000;
      word-break: break-word;
      overflow-wrap: break-word;
      box-sizing: border-box;
    }
    /* Chống rớt dòng ký hiệu tiền tệ đ và số tiền, tạo khoảng đệm lề phải an toàn */
    .nowrap,
    .price-cell,
    td[style*="text-align: right"],
    th[style*="text-align: right"],
    td[style*="text-align:right"],
    th[style*="text-align:right"] {
      white-space: nowrap !important;
      padding-right: 1.5px !important;
    }
    td[style*="text-align: left"],
    th[style*="text-align: left"],
    td[style*="text-align:left"],
    th[style*="text-align:left"] {
      word-break: break-word;
    }
    @media print {
      @page {
        size: ${pageSizeDirective};
        margin: 0mm !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        text-rendering: geometricPrecision;
      }
      .print-container {
        padding: ${containerPadding} !important;
        width: ${widthCss} !important;
        max-width: ${widthCss} !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      table, tr, td, th, div, span, img {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${bodyHtml}
  </div>
</body>
</html>`;
  }

  /**
   * Tạo Barcode SVG Code128B chuẩn in nhiệt
   */
  private generateInlineCode128Svg(text: string): string {
    const cleanText = text.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20) || 'AVORA';
    // Mô phỏng Barcode Code128 sạch đẹp dạng SVG
    const bars: number[] = [];
    for (let i = 0; i < cleanText.length; i++) {
      const code = cleanText.charCodeAt(i);
      bars.push((code % 3) + 1, ((code >> 1) % 2) + 1, ((code >> 2) % 3) + 1, 1);
    }
    bars.push(2, 1, 1, 2, 3, 2); // Stop bar

    let x = 10;
    const height = 45;
    let rects = '';
    let isBar = true;

    for (const w of bars) {
      const width = w * 1.5;
      if (isBar) {
        rects += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000" />`;
      }
      x += width;
      isBar = !isBar;
    }

    const totalWidth = x + 10;

    return `<div style="text-align:center; margin: 4px auto;">
      <svg width="${totalWidth}" height="${height + 15}" viewBox="0 0 ${totalWidth} ${height + 15}" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;">
        ${rects}
        <text x="${totalWidth / 2}" y="${height + 12}" font-family="monospace" font-size="11" text-anchor="middle" fill="#000">${cleanText}</text>
      </svg>
    </div>`;
  }

  /**
   * Emergency Fallback Template khi chi nhánh chưa có mẫu hoặc lỗi
   */
  getEmergencyTemplate(type: PrintTemplateType): { name: string; content: string; paperSize: string } {
    return this.tagsService.getDefaultTemplateContent(type);
  }

  // Định dạng tiền tệ VND – ký hiệu ₫ gắn liền vào số, không có khoảng trắng
  formatCurrency(val?: number): string {
    if (val === undefined || val === null || isNaN(val)) {
      return '0₫';
    }
    return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + '₫';
  }

  // Định dạng ngày giờ chuẩn HH:mm dd/MM/yyyy
  formatDateTime(dateVal?: Date | string): string {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  }

  // Định dạng giờ phút ngắn
  formatTime(dateVal?: Date | string): string {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${hours}:${minutes}`;
  }

  // Định dạng số
  formatNumber(val?: number): string {
    if (val === undefined || val === null || isNaN(val)) {
      return '0';
    }
    return new Intl.NumberFormat('vi-VN').format(val);
  }
}
