import { Injectable } from '@nestjs/common';
import { PrintTemplateType } from '@prisma/client';

export interface PrintTagDefinition {
  tag: string;
  name: string;
  category: string;
  description: string;
  isItemScoped?: boolean;
  exampleValue?: string;
}

export interface TagCategory {
  key: string;
  title: string;
  tags: PrintTagDefinition[];
}

@Injectable()
export class PrintTemplateTagsService {
  private readonly tagRegistry: PrintTagDefinition[] = [
    // 1. Cửa hàng & Chi nhánh
    { tag: '[Ten_Cua_Hang]', name: 'Tên cửa hàng / Thương hiệu', category: 'branch', description: 'Tên thương hiệu hệ thống', exampleValue: 'AVORA RESTAURANT' },
    { tag: '[Ten_Chi_Nhanh]', name: 'Tên chi nhánh', category: 'branch', description: 'Tên chi nhánh phát sinh hóa đơn', exampleValue: 'Chi nhánh Quận 1' },
    { tag: '[Ma_Chi_Nhanh]', name: 'Mã chi nhánh', category: 'branch', description: 'Mã định danh chi nhánh', exampleValue: 'CN-Q1' },
    { tag: '[Dia_Chi_Chi_Nhanh]', name: 'Địa chỉ chi nhánh', category: 'branch', description: 'Địa chỉ đầy đủ của chi nhánh', exampleValue: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1' },
    { tag: '[Dien_Thoai_Chi_Nhanh]', name: 'Điện thoại chi nhánh', category: 'branch', description: 'Hotline/SĐT chi nhánh', exampleValue: '0901 234 567' },
    { tag: '[Dia_Chi_Cua_Hang]', name: 'Địa chỉ nhà hàng chính', category: 'branch', description: 'Trụ sở chính hoặc cấu hình chung', exampleValue: '123 Nguyễn Huệ, Q.1, TP.HCM' },
    { tag: '[Dien_Thoai_Cua_Hang]', name: 'Hotline tổng', category: 'branch', description: 'Tổng đài chăm sóc khách hàng', exampleValue: '1900 6868' },

    // 2. Hóa đơn & Bàn
    { tag: '[Ma_Hoa_Don]', name: 'Mã hóa đơn / Mã đơn', category: 'order', description: 'Mã đơn hàng duy nhất', exampleValue: 'AV260905-0012' },
    { tag: '[Ngay_Tao]', name: 'Ngày giờ tạo đơn', category: 'order', description: 'Thời điểm bắt đầu tạo đơn', exampleValue: '05/09/2026 19:45' },
    { tag: '[Gio_Tao]', name: 'Giờ tạo đơn ngắn', category: 'order', description: 'Giờ phút tạo đơn (HH:mm)', exampleValue: '19:45' },
    { tag: '[Ngay_Hoan_Thanh]', name: 'Ngày giờ in / thanh toán', category: 'order', description: 'Thời điểm hoàn thành đơn hoặc in', exampleValue: '05/09/2026 20:15' },
    { tag: '[Gio_In]', name: 'Ngày giờ in phiếu', category: 'order', description: 'Thời điểm in phiếu (HH:mm dd/MM/yyyy)', exampleValue: '09:15 07/09/2026' },
    { tag: '[Ngay_Gio_In]', name: 'Ngày giờ in đầy đủ', category: 'order', description: 'Thời điểm in phiếu (HH:mm dd/MM/yyyy)', exampleValue: '09:15 07/09/2026' },
    { tag: '[Ten_Ban]', name: 'Tên bàn / Khu vực', category: 'order', description: 'Bàn ngồi hoặc Loại Mang đi / Giao hàng', exampleValue: 'Bàn A-05' },
    { tag: '[Loai_Don_Hang]', name: 'Loại đơn hàng', category: 'order', description: 'Tại bàn, Mang đi, Giao hàng', exampleValue: 'Tại bàn (Dine-in)' },
    { tag: '[Trang_Thai_Don_Hang]', name: 'Trạng thái đơn hàng', category: 'order', description: 'Đang phục vụ, Đã thanh toán...', exampleValue: 'Đã hoàn tất' },
    { tag: '[Ghi_Chu_Don_Hang]', name: 'Ghi chú đơn hàng', category: 'order', description: 'Ghi chú chung của đơn', exampleValue: 'Giao nhanh trước 20h' },
    { tag: '[Ten_Thu_Ngan]', name: 'Tên thu ngân / Nhân viên', category: 'order', description: 'Người lập đơn hoặc xử lý thanh toán', exampleValue: 'Nguyễn Văn Thu Ngân' },
    { tag: '[So_Luong_Khach]', name: 'Số lượng khách', category: 'order', description: 'Số khách ngồi bàn', exampleValue: '4' },

    // 3. Khách hàng & Thành viên
    { tag: '[Ten_Khach_Hang]', name: 'Tên khách hàng', category: 'customer', description: 'Tên khách đặt đơn hoặc tích điểm', exampleValue: 'Trần Thị Mai' },
    { tag: '[Dien_Thoai_Khach_Hang]', name: 'Số điện thoại khách hàng', category: 'customer', description: 'SĐT khách hàng', exampleValue: '0988 776 655' },
    { tag: '[Ma_Thanh_Vien]', name: 'Mã thành viên', category: 'customer', description: 'Mã thẻ thành viên AVORA', exampleValue: 'MEM-88992' },
    { tag: '[Hang_Thanh_Vien]', name: 'Hạng thành viên', category: 'customer', description: 'Đồng, Bạc, Vàng, Kim Cương...', exampleValue: 'Hạng Vàng (Gold)' },
    { tag: '[Diem_Hien_Tai]', name: 'Điểm hiện tại', category: 'customer', description: 'Số điểm tích lũy trong ví', exampleValue: '1.250' },
    { tag: '[Diem_Da_Dung]', name: 'Điểm đã dùng đơn này', category: 'customer', description: 'Điểm quy đổi trừ tiền đơn', exampleValue: '50' },
    { tag: '[Diem_Tich_Luy]', name: 'Điểm cộng đơn này', category: 'customer', description: 'Điểm thưởng nhận được sau đơn', exampleValue: '45' },
    { tag: '[Chi_Tiet_Khach_Hang]', name: 'Khối thông tin thành viên đầy đủ', category: 'customer', description: 'Bảng tóm tắt thẻ và điểm khách', exampleValue: 'KH: Trần Thị Mai - Vàng (1.250 điểm)' },

    // 4. Giao hàng
    { tag: '[Dia_Chi_Giao_Hang]', name: 'Địa chỉ giao hàng', category: 'shipping', description: 'Địa chỉ nhận món của khách', exampleValue: '45 Lê Lợi, Bến Nghé, Q.1' },
    { tag: '[Phi_Giao_Hang]', name: 'Phí giao hàng', category: 'shipping', description: 'Cước vận chuyển', exampleValue: '25.000 đ' },
    { tag: '[Giam_Gia_Van_Chuyen]', name: 'Giảm giá vận chuyển', category: 'shipping', description: 'Freeship / Hỗ trợ ship', exampleValue: '-25.000 đ' },

    // 5. Món ăn (Item Scoped - dùng trong {{#items}})
    { tag: '[Ten_Mon_An]', name: 'Tên món ăn', category: 'item', description: 'Tên món kèm biến thể', isItemScoped: true, exampleValue: 'Cá hồi Na Uy sốt Teriyaki' },
    { tag: '[Ma_Mon]', name: 'Mã món ăn', category: 'item', description: 'Mã SKU / Item code', isItemScoped: true, exampleValue: 'MON-012' },
    { tag: '[So_Luong]', name: 'Số lượng món', category: 'item', description: 'Số lượng phần/ly gọi', isItemScoped: true, exampleValue: '2' },
    { tag: '[Don_Vi_Tinh]', name: 'Đơn vị tính', category: 'item', description: 'phần, đĩa, ly, set...', isItemScoped: true, exampleValue: 'phần' },
    { tag: '[Gia_Goc]', name: 'Giá gốc món', category: 'item', description: 'Đơn giá gốc trước khuyến mãi', isItemScoped: true, exampleValue: '150.000 đ' },
    { tag: '[Don_Gia]', name: 'Đơn giá bán', category: 'item', description: 'Đơn giá bán tại thời điểm mua', isItemScoped: true, exampleValue: '135.000 đ' },
    { tag: '[Giam_Gia_Mon]', name: 'Giảm giá món', category: 'item', description: 'Số tiền giảm trên món', isItemScoped: true, exampleValue: '15.000 đ' },
    { tag: '[Tien_Truoc_Thue_Mon]', name: 'Tiền trước thuế món', category: 'item', description: 'Giá bán chưa gồm VAT', isItemScoped: true, exampleValue: '125.000 đ' },
    { tag: '[Thue_Mon]', name: 'Tiền thuế món', category: 'item', description: 'Tiền VAT trên món', isItemScoped: true, exampleValue: '10.000 đ' },
    { tag: '[Thanh_Tien]', name: 'Thành tiền món', category: 'item', description: 'Số lượng nhân đơn giá', isItemScoped: true, exampleValue: '270.000 đ' },
    { tag: '[Tuy_Chon_Mon]', name: 'Tùy chọn / Topping', category: 'item', description: 'Gia vị, size, độ ngọt, đá...', isItemScoped: true, exampleValue: '+ Ít cay, Thêm phô mai' },
    { tag: '[Ghi_Chu_Mon]', name: 'Ghi chú món ăn', category: 'item', description: 'Yêu cầu riêng của khách trên món', isItemScoped: true, exampleValue: 'Không tiêu, làm chín kỹ' },
    { tag: '[Nguoi_Them_Mon]', name: 'Người gọi món', category: 'item', description: 'Nhân viên gọi món', isItemScoped: true, exampleValue: 'Phục vụ Tuấn' },
    { tag: '[Ngay_Gio_Goi_Mon]', name: 'Giờ gọi món', category: 'item', description: 'Thời điểm món được thêm', isItemScoped: true, exampleValue: '19:48' },
    { tag: '[VAT_Tung_Mon]', name: 'Tiền VAT món', category: 'item', description: 'Tiền thuế món', isItemScoped: true, exampleValue: '10.000 đ' },
    { tag: '[%_VAT_Tung_Mon]', name: 'Tỷ lệ % VAT món', category: 'item', description: 'Thuế suất %', isItemScoped: true, exampleValue: '8%' },

    // 6. Tổng tiền & Voucher kép
    { tag: '[Tam_Tinh]', name: 'Tạm tính / Tổng tiền hàng', category: 'finance', description: 'Tổng tiền các món trước giảm giá', exampleValue: '450.000 đ' },
    { tag: '[Tong_Tien_Hang]', name: 'Tổng tiền hàng', category: 'finance', description: 'Tiền hàng', exampleValue: '450.000 đ' },
    { tag: '[Tong_Tien_Truoc_Thue]', name: 'Tổng tiền trước thuế', category: 'finance', description: 'Tổng giá trị chưa gồm VAT', exampleValue: '416.666 đ' },
    { tag: '[Tong_So_Luong]', name: 'Tổng số lượng món', category: 'finance', description: 'Tổng số phần ăn trong đơn', exampleValue: '3' },
    { tag: '[Tong_VAT]', name: 'Tổng tiền VAT', category: 'finance', description: 'Tổng thuế giá trị gia tăng', exampleValue: '33.334 đ' },
    { tag: '[Giam_Gia]', name: 'Tổng giảm giá', category: 'finance', description: 'Tổng tiền giảm giá và khuyến mãi', exampleValue: '50.000 đ' },
    { tag: '[Tong_Cong]', name: 'Tổng thanh toán', category: 'finance', description: 'Số tiền cuối cùng khách cần trả', exampleValue: '400.000 đ' },
    { tag: '[Ma_Voucher_Giam_Gia]', name: 'Mã voucher giảm giá', category: 'finance', description: 'Mã giảm giá đơn hàng', exampleValue: 'GIAM10' },
    { tag: '[Ma_Voucher_Freeship]', name: 'Mã voucher vận chuyển', category: 'finance', description: 'Mã miễn/giảm phí ship', exampleValue: 'FREESHIP' },
    { tag: '[Voucher_Giam_Gia]', name: 'Thông tin voucher giảm giá', category: 'finance', description: 'Hiển thị: [Mã] - [Số tiền giảm]', exampleValue: 'GIAM10 (-50.000 đ)' },
    { tag: '[Voucher_Freeship]', name: 'Thông tin voucher vận chuyển', category: 'finance', description: 'Hiển thị: [Mã] - [Tiền giảm ship]', exampleValue: 'FREESHIP (-25.000 đ)' },
    { tag: '[Tien_Giam_Voucher]', name: 'Tiền giảm từ voucher', category: 'finance', description: 'Số tiền giảm của voucher', exampleValue: '50.000 đ' },
    { tag: '[Tien_Giam_Freeship]', name: 'Tiền giảm từ voucher ship', category: 'finance', description: 'Số tiền giảm ship', exampleValue: '25.000 đ' },
    { tag: '[Phu_Phi]', name: 'Phụ phí / Dịch vụ', category: 'finance', description: 'Tổng tiền phí dịch vụ/phụ thu', exampleValue: '25.000 đ' },
    { tag: '[Tong_Phu_Phi]', name: 'Tổng phụ phí / Dịch vụ', category: 'finance', description: 'Tổng tiền phụ phí / dịch vụ', exampleValue: '25.000 đ' },
    { tag: '[Phi_Dich_Vu]', name: 'Phí dịch vụ', category: 'finance', description: 'Phí dịch vụ nhà hàng', exampleValue: '25.000 đ' },
    { tag: '[Che_Do_VAT]', name: 'Chế độ tính thuế VAT', category: 'finance', description: 'Đã bao gồm VAT hoặc Chưa bao gồm VAT', exampleValue: 'Đã bao gồm VAT' },
    { tag: '[Phan_Tram_VAT]', name: 'Tỷ lệ % VAT', category: 'finance', description: 'Thuế suất VAT trung bình của đơn', exampleValue: '8%' },
    { tag: '[Chi_Tiet_VAT]', name: 'Chi tiết từng mức thuế VAT', category: 'finance', description: 'Các dòng phân tách VAT theo thuế suất', exampleValue: '<tr>...</tr>' },
    { tag: '[Chi_Tiet_Phu_Phi]', name: 'Chi tiết các khoản phụ phí', category: 'finance', description: 'Các dòng phân tách phụ phí dịch vụ', exampleValue: '<tr>...</tr>' },
    { tag: '[Chi_Tiet_Giam_Gia]', name: 'Chi tiết các khoản giảm giá', category: 'finance', description: 'Các dòng chi tiết voucher / khuyến mãi', exampleValue: '<tr>...</tr>' },

    // 7. Thanh toán
    { tag: '[Phuong_Thuc_Thanh_Toan]', name: 'Phương thức thanh toán', category: 'payment', description: 'Tiền mặt, Chuyển khoản, Thẻ, SePay QR', exampleValue: 'Tiền mặt' },
    { tag: '[Trang_Thai_Thanh_Toan]', name: 'Trạng thái thanh toán', category: 'payment', description: 'Đã thanh toán / Chưa thanh toán', exampleValue: 'Đã thanh toán' },
    { tag: '[Ma_Giao_Dich]', name: 'Mã giao dịch', category: 'payment', description: 'Mã tham chiếu thanh toán', exampleValue: 'TXN-998822' },
    { tag: '[Thoi_Gian_Thanh_Toan]', name: 'Thời gian thanh toán', category: 'payment', description: 'Thời điểm thanh toán thành công', exampleValue: '05/09/2026 20:16' },
    { tag: '[Tien_Khach_Tra]', name: 'Tiền khách đưa', category: 'payment', description: 'Số tiền mặt khách đưa thu ngân', exampleValue: '500.000 đ' },
    { tag: '[Tien_Thoi]', name: 'Tiền thối lại', category: 'payment', description: 'Tiền thừa trả lại cho khách', exampleValue: '100.000 đ' },
    { tag: '[Ma_QR_Thanh_Toan]', name: 'Mã QR thanh toán ngân hàng', category: 'payment', description: 'Hình ảnh QR VietQR / SePay thanh toán', exampleValue: '<img src="data:image/png;base64,..." width="140" />' },
    { tag: '[Noi_Dung_Chuyen_Khoan]', name: 'Nội dung chuyển khoản', category: 'payment', description: 'Cú pháp chuyển khoản', exampleValue: 'AV260905 0012' },
    { tag: '[So_Tai_Khoan]', name: 'Số tài khoản ngân hàng', category: 'payment', description: 'STK nhận tiền', exampleValue: '1028889999' },
    { tag: '[Ten_Tai_Khoan]', name: 'Tên chủ tài khoản', category: 'payment', description: 'Chủ tài khoản ngân hàng', exampleValue: 'AVORA RESTAURANT' },
    { tag: '[Ngan_Hang]', name: 'Tên ngân hàng', category: 'payment', description: 'Ngân hàng thụ hưởng', exampleValue: 'Vietcombank' },

    // 8. Hóa đơn VAT
    { tag: '[Ma_So_Thue]', name: 'Mã số thuế', category: 'vat', description: 'MST doanh nghiệp yêu cầu hóa đơn', exampleValue: '0315888999' },
    { tag: '[Ten_Cong_Ty]', name: 'Tên công ty / Đơn vị', category: 'vat', description: 'Tên công ty xuất hóa đơn', exampleValue: 'CÔNG TY TNHH ẨM THỰC AVORA' },
    { tag: '[Dia_Chi_Cong_Ty]', name: 'Địa chỉ công ty', category: 'vat', description: 'Địa chỉ đăng ký kinh doanh', exampleValue: '123 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM' },
    { tag: '[Email_Hoa_Don]', name: 'Email nhận hóa đơn', category: 'vat', description: 'Email gửi hóa đơn điện tử', exampleValue: 'ketoan@avora.vn' },

    // 9. QR & Barcode
    { tag: '[Ma_QR_Website]', name: 'Mã QR Website / Menu Online', category: 'barcode', description: 'Ảnh QR dẫn tới website nhà hàng', exampleValue: '<img src="data:image/png;base64,..." width="100" />' },
    { tag: '[Ma_QR_Don_Hang]', name: 'Mã QR tra cứu đơn hàng', category: 'barcode', description: 'Ảnh QR quét tra cứu đơn hàng', exampleValue: '<img src="data:image/png;base64,..." width="100" />' },
    { tag: '[Ma_Vach_Hoa_Don]', name: 'Mã vạch hóa đơn (Barcode)', category: 'barcode', description: 'Mã vạch Code128 theo mã đơn', exampleValue: '<img src="data:image/png;base64,..." width="160" />' },
    { tag: '[Ma_QR_Mon_An]', name: 'Mã QR món ăn', category: 'barcode', description: 'QR thông tin món ăn', isItemScoped: true, exampleValue: '<img src="data:image/png;base64,..." width="80" />' },
    { tag: '[Ma_Vach_Barcode]', name: 'Mã vạch sản phẩm', category: 'barcode', description: 'Barcode mã sản phẩm', isItemScoped: true, exampleValue: '<img src="data:image/png;base64,..." width="120" />' },
  ];

  getTagRegistry(): PrintTagDefinition[] {
    return this.tagRegistry;
  }

  getCategorizedTags(): TagCategory[] {
    const categoryTitles: Record<string, string> = {
      branch: 'Cửa hàng & Chi nhánh',
      order: 'Hóa đơn & Bàn',
      customer: 'Khách hàng & Thành viên',
      shipping: 'Giao hàng',
      item: 'Món ăn (Vòng lặp)',
      finance: 'Tổng tiền & Giảm giá',
      payment: 'Thanh toán & Tiền thối',
      vat: 'Hóa đơn VAT',
      barcode: 'QR & Barcode',
    };

    const categories: Record<string, PrintTagDefinition[]> = {};
    for (const tag of this.tagRegistry) {
      if (!categories[tag.category]) {
        categories[tag.category] = [];
      }
      categories[tag.category].push(tag);
    }

    return Object.keys(categoryTitles).map((key) => ({
      key,
      title: categoryTitles[key] || key,
      tags: categories[key] || [],
    }));
  }

  isValidTag(tagName: string): boolean {
    return this.tagRegistry.some((item) => item.tag === tagName);
  }

  isItemScopedTag(tagName: string): boolean {
    const item = this.tagRegistry.find((t) => t.tag === tagName);
    return Boolean(item?.isItemScoped);
  }

  // Danh sách các điều kiện hợp lệ
  getAllowedConditions(): string[] {
    return [
      'voucher',
      'discountVoucher',
      'shippingVoucher',
      'discount',
      'shipping',
      'hasShippingFee',
      'hasDeliveryAddress',
      'customer',
      'membership',
      'vat',
      'hasVat',
      'vatInclusive',
      'vatExclusive',
      'noVat',
      'vatInvoice',
      'serviceCharge',
      'hasServiceCharge',
      'hasDiscount',
      'cashPayment',
      'qrPayment',
      'note',
      'table',
    ];
  }

  // Mẫu seed mặc định chuẩn nhiệt 80mm/58mm cho 5 loại
  getDefaultTemplateContent(type: PrintTemplateType): { name: string; content: string; paperSize: string } {
    switch (type) {
      case PrintTemplateType.RECEIPT:
        return {
          name: 'Hóa đơn thanh toán 80mm',
          paperSize: '80mm',
          content: `<div style="font-family: Arial, sans-serif; font-size: 11.5px; line-height: 1.35; color: #000; width: 100%; text-align: center;">
  <div style="font-size: 15px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">[Ten_Cua_Hang]</div>
  <div style="font-size: 12px; margin-bottom: 2px;">[Ten_Chi_Nhanh]</div>
  <div style="font-size: 10.5px; color: #333; margin-bottom: 1px;">Đ/C: [Dia_Chi_Chi_Nhanh]</div>
  <div style="font-size: 10.5px; color: #333; margin-bottom: 3px;">Hotline: [Dien_Thoai_Chi_Nhanh]</div>
  <div style="border-top: 1px solid #000; margin: 3px 0 2px 0;"></div>
  <div style="font-size: 15px; font-weight: 600; margin: 2px 0 1px 0; letter-spacing: 0.5px;">HÓA ĐƠN THANH TOÁN</div>
  <div style="font-size: 11px; margin-bottom: 2px; white-space: nowrap;">[Ma_Hoa_Don] - [Gio_In]</div>
  <div style="border-bottom: 1px dashed #000; margin: 3px 0 4px 0;"></div>

  <table style="width: 100%; font-size: 11px; text-align: left; margin-bottom: 3px; border-collapse: collapse;">
    <tr>
      <td style="padding: 1.5px 0; white-space: nowrap; width: 55%;">Bàn: [Ten_Ban]</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap; width: 45%;">Số khách: [So_Luong_Khach]</td>
    </tr>
    <tr>
      <td style="padding: 1.5px 0; white-space: nowrap;">Giờ vào: [Ngay_Tao]</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">Giờ ra: [Ngay_Hoan_Thanh]</td>
    </tr>
    <tr>
      <td colspan="2" style="padding: 1.5px 0; white-space: nowrap;">Thu ngân: [Ten_Thu_Ngan]</td>
    </tr>
    {{#if customer}}
    <tr>
      <td colspan="2" style="padding: 1.5px 0; font-size: 11px; white-space: normal; word-break: break-word; border-top: 1px dotted #888;">
        Khách hàng: [Ten_Khach_Hang] - [Dien_Thoai_Khach_Hang]
        {{#if membership}}<br/><span style="font-size: 10.5px; color: #333;">[Hang_Thanh_Vien] | Tích điểm: +[Diem_Tich_Luy] (Ví: [Diem_Hien_Tai])</span>{{/if}}
      </td>
    </tr>
    {{/if}}
    {{#if hasDeliveryAddress}}
    <tr>
      <td colspan="2" style="padding: 1.5px 0; font-size: 11px; white-space: normal; word-break: break-word; border-top: 1px dotted #888;">
        Giao đến: [Dia_Chi_Giao_Hang]
      </td>
    </tr>
    {{/if}}
  </table>

  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 3px 0;">
    <thead>
      <tr style="border-top: 1px solid #000; border-bottom: 1px solid #000;">
        <th style="text-align: left; padding: 2.5px 0; width: 46%; font-weight: 600;">Mặt hàng</th>
        <th style="text-align: center; padding: 2.5px 0; width: 9%; white-space: nowrap; font-weight: 600;">SL</th>
        <th style="text-align: right; padding: 2.5px 0; width: 22%; white-space: nowrap; font-weight: 600;">Đ.Giá</th>
        <th style="text-align: right; padding: 2.5px 0; width: 23%; white-space: nowrap; font-weight: 600;">T.Tiền</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr style="border-bottom: 1px dotted #ccc;">
        <td style="text-align: left; padding: 2.5px 0; word-break: break-word; overflow-wrap: break-word;">
          <div style="font-weight: 600; line-height: 1.25;">[Ten_Mon_An]</div>
          <div style="font-size: 9.5px; color: #555;">[Tuy_Chon_Mon]</div>
          <div style="font-size: 9.5px; font-style: italic; color: #555;">[Ghi_Chu_Mon]</div>
        </td>
        <td style="text-align: center; vertical-align: top; padding: 2.5px 0; white-space: nowrap;">[So_Luong]</td>
        <td style="text-align: right; vertical-align: top; padding: 2.5px 0; white-space: nowrap;">[Don_Gia]</td>
        <td style="text-align: right; vertical-align: top; padding: 2.5px 0; white-space: nowrap;">[Thanh_Tien]</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <table style="width: 100%; font-size: 11px; margin-top: 2px; border-collapse: collapse;">
    {{#if vatExclusive}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Tiền hàng trước VAT([Tong_So_Luong]):</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Thuế VAT:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">([Phan_Tram_VAT]) [Tong_VAT]</td>
    </tr>
    [Chi_Tiet_VAT]
    {{/if}}
    {{#if vatInclusive}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Tiền hàng([Tong_So_Luong]):</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 1px 0; font-size: 10.5px; color: #444;">VAT (đã bao gồm):</td>
      <td style="text-align: right; padding: 1px 0; font-size: 10.5px; color: #444; white-space: nowrap;">([Phan_Tram_VAT]) [Tong_VAT]</td>
    </tr>
    [Chi_Tiet_VAT]
    {{/if}}
    {{#if noVat}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Tiền hàng([Tong_So_Luong]):</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    {{/if}}
    {{#if hasShippingFee}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Phí vận chuyển:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Phi_Giao_Hang]</td>
    </tr>
    {{/if}}
    {{#if serviceCharge}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Phụ phí / Dịch vụ:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">+[Tong_Phu_Phi]</td>
    </tr>
    [Chi_Tiet_Phu_Phi]
    {{/if}}
    {{#if discount}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Giảm giá:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">-[Giam_Gia]</td>
    </tr>
    [Chi_Tiet_Giam_Gia]
    {{/if}}
    {{#if discountVoucher}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Voucher ([Ma_Voucher_Giam_Gia]):</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">-[Tien_Giam_Voucher]</td>
    </tr>
    {{/if}}
    {{#if shippingVoucher}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Freeship ([Ma_Voucher_Freeship]):</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">-[Tien_Giam_Freeship]</td>
    </tr>
    {{/if}}
    <tr style="border-top: 1px dashed #000; border-bottom: 1.5px solid #000;">
      <td style="text-align: left; padding: 4px 0; font-size: 13px; font-weight: 600;">TỔNG THANH TOÁN:</td>
      <td style="text-align: right; padding: 4px 0; font-size: 14px; font-weight: 600; white-space: nowrap;">[Tong_Cong]</td>
    </tr>
  </table>

  <table style="width: 100%; font-size: 11px; margin-top: 3px; border-collapse: collapse;">
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Phương thức:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Phuong_Thuc_Thanh_Toan]</td>
    </tr>
    {{#if cashPayment}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Tiền khách đưa:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Tien_Khach_Tra]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Tiền thối lại:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Tien_Thoi]</td>
    </tr>
    {{/if}}
    {{#if vatInvoice}}
    <tr style="border-top: 1px dotted #888;">
      <td colspan="2" style="text-align: left; padding: 3px 0; font-size: 10.5px;">
        Xuất HĐ VAT: [Ten_Cong_Ty]<br/>
        MST: [Ma_So_Thue] | Email: [Email_Hoa_Don]
      </td>
    </tr>
    {{/if}}
  </table>

  <div style="page-break-inside: avoid !important; break-inside: avoid !important; margin: 3px 0 1px 0;">
    [Ma_QR_Website]
    <div style="font-size: 11px; font-weight: 600; margin-top: 2px;">CẢM ƠN QUÝ KHÁCH VÀ HẸN GẶP LẠI!</div>
    <div style="font-size: 9.5px; color: #555; margin-top: 1px;">Wifi: AVORA_GUEST | Pass: avora2026</div>
  </div>
</div>`,
        };

      case PrintTemplateType.TEMP_BILL:
        return {
          name: 'Phiếu tạm tính 80mm',
          paperSize: '80mm',
          content: `<div style="font-family: Arial, sans-serif; font-size: 11.5px; line-height: 1.35; color: #000; width: 100%; text-align: center;">
  <div style="font-size: 15px; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">[Ten_Cua_Hang]</div>
  <div style="font-size: 12px; margin-bottom: 2px;">[Ten_Chi_Nhanh]</div>
  <div style="border-top: 1px solid #000; margin: 3px 0 2px 0;"></div>
  <div style="font-size: 15px; font-weight: 600; margin: 2px 0 1px 0; letter-spacing: 0.5px;">PHIẾU TẠM TÍNH</div>
  <div style="font-size: 11px; margin-bottom: 1px; white-space: nowrap;">[Ma_Hoa_Don] - [Gio_In]</div>
  <div style="font-size: 10px; font-style: italic; color: #444;">(Vui lòng kiểm tra lại món trước khi thanh toán)</div>
  <div style="border-bottom: 1px dashed #000; margin: 3px 0 4px 0;"></div>

  <table style="width: 100%; font-size: 11px; text-align: left; margin-bottom: 3px; border-collapse: collapse;">
    <tr>
      <td colspan="2" style="padding: 1.5px 0; font-size: 11px; white-space: nowrap;">Bàn: [Ten_Ban]</td>
    </tr>
    <tr>
      <td style="padding: 1.5px 0; white-space: nowrap; width: 55%;">Giờ vào: [Ngay_Tao]</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap; width: 45%;">Số khách: [So_Luong_Khach]</td>
    </tr>
    <tr>
      <td colspan="2" style="padding: 1.5px 0; font-size: 11px; white-space: normal; word-break: break-word;">Khách hàng: [Chi_Tiet_Khach_Hang]</td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 3px 0;">
    <thead>
      <tr style="border-top: 1px solid #000; border-bottom: 1px solid #000;">
        <th style="text-align: left; padding: 2.5px 0; width: 46%; font-weight: 600;">Mặt hàng</th>
        <th style="text-align: center; padding: 2.5px 0; width: 9%; white-space: nowrap; font-weight: 600;">SL</th>
        <th style="text-align: right; padding: 2.5px 0; width: 22%; white-space: nowrap; font-weight: 600;">Đ.Giá</th>
        <th style="text-align: right; padding: 2.5px 0; width: 23%; white-space: nowrap; font-weight: 600;">T.Tiền</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr style="border-bottom: 1px dotted #ccc;">
        <td style="text-align: left; padding: 2.5px 0; word-break: break-word; overflow-wrap: break-word;">
          <div style="font-weight: 600; line-height: 1.25;">[Ten_Mon_An]</div>
          <div style="font-size: 9.5px; color: #555;">[Tuy_Chon_Mon]</div>
        </td>
        <td style="text-align: center; vertical-align: top; padding: 2.5px 0; white-space: nowrap;">[So_Luong]</td>
        <td style="text-align: right; vertical-align: top; padding: 2.5px 0; white-space: nowrap;">[Don_Gia]</td>
        <td style="text-align: right; vertical-align: top; padding: 2.5px 0; white-space: nowrap;">[Thanh_Tien]</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <table style="width: 100%; font-size: 11px; margin-top: 2px; border-collapse: collapse;">
    {{#if vatExclusive}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">TT trước VAT([Tong_So_Luong]):</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">VAT:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">([Phan_Tram_VAT]) [Tong_VAT]</td>
    </tr>
    [Chi_Tiet_VAT]
    {{/if}}
    {{#if vatInclusive}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Tiền hàng([Tong_So_Luong]):</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 1px 0; font-size: 10.5px; color: #444;">VAT (đã bao gồm):</td>
      <td style="text-align: right; padding: 1px 0; font-size: 10.5px; color: #444; white-space: nowrap;">([Phan_Tram_VAT]) [Tong_VAT]</td>
    </tr>
    [Chi_Tiet_VAT]
    {{/if}}
    {{#if noVat}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Tạm tính([Tong_So_Luong]):</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    {{/if}}
    {{#if hasShippingFee}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Phí vận chuyển:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">[Phi_Giao_Hang]</td>
    </tr>
    {{/if}}
    {{#if serviceCharge}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Phụ phí / Dịch vụ:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">+[Tong_Phu_Phi]</td>
    </tr>
    [Chi_Tiet_Phu_Phi]
    {{/if}}
    {{#if discount}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0;">Giảm giá:</td>
      <td style="text-align: right; padding: 1.5px 0; white-space: nowrap;">-[Giam_Gia]</td>
    </tr>
    [Chi_Tiet_Giam_Gia]
    {{/if}}
    <tr style="border-top: 1px dashed #000; border-bottom: 1.5px solid #000;">
      <td style="text-align: left; padding: 4px 0; font-size: 13px; font-weight: 600;">TỔNG TIỀN:</td>
      <td style="text-align: right; padding: 4px 0; font-size: 14px; font-weight: 600; white-space: nowrap;">[Tong_Cong]</td>
    </tr>
  </table>

  {{#if qrPayment}}
  <div style="page-break-inside: avoid !important; break-inside: avoid !important; margin: 3px 0 1px 0;">
    <div style="font-size: 10px; margin-bottom: 1px;">Quét QR chuyển khoản thanh toán nhanh:</div>
    [Ma_QR_Thanh_Toan]
    <div style="font-size: 10px; margin-top: 1px;">[Ngan_Hang] - STK: [So_Tai_Khoan]</div>
  </div>
  {{/if}}

  <div style="page-break-inside: avoid !important; break-inside: avoid !important; margin-top: 2px; font-size: 9.5px; color: #444;">(Phiếu này chưa phải là hóa đơn tài chính)</div>
</div>`,
        };

      case PrintTemplateType.KITCHEN_TICKET:
        return {
          name: 'Phiếu gửi Bếp / Bar 80mm',
          paperSize: '80mm',
          content: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.4; color: #000; width: 100%; text-align: left;">
  <div style="border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <span style="font-size: 18px; font-weight: 900;">BẾP / BAR</span>
      <span style="font-size: 12px; margin-left: 6px;">[Ten_Chi_Nhanh]</span>
    </div>
    <div style="font-size: 12px; font-weight: bold;">[Ngay_Tao]</div>
  </div>

  <div style="font-size: 20px; font-weight: 900; background: #000; color: #fff; padding: 4px 6px; text-align: center; margin-bottom: 6px;">
    BÀN: [Ten_Ban]
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
    <div>Mã đơn: <b>[Ma_Hoa_Don]</b></div>
    <div>NV: [Ten_Thu_Ngan]</div>
  </div>

  {{#if note}}
  <div style="border: 2px dashed #000; padding: 6px; font-size: 14px; font-weight: bold; margin-bottom: 8px;">
    YÊU CẦU TỪ KHÁCH:<br/>
    <span style="font-size: 15px;">[Ghi_Chu_Don_Hang]</span>
  </div>
  {{/if}}

  <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
    <thead>
      <tr style="border-top: 1px solid #000; border-bottom: 2px solid #000; font-size: 13px;">
        <th style="text-align: center; width: 22%; padding: 4px 0;">SL</th>
        <th style="text-align: left; width: 78%; padding: 4px 0;">Mặt hàng & Yêu cầu</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr style="border-bottom: 1px dashed #000;">
        <td style="text-align: center; vertical-align: top; font-size: 22px; font-weight: 900; padding: 8px 0;">
          [So_Luong]
        </td>
        <td style="padding: 6px 0 6px 8px; vertical-align: top;">
          <div style="font-size: 16px; font-weight: bold;">[Ten_Mon_An]</div>
          <div style="font-size: 13px; font-weight: 600; margin-top: 2px;">[Tuy_Chon_Mon]</div>
          <div style="font-size: 13px; font-style: italic; color: #111;">[Ghi_Chu_Mon]</div>
        </td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <div style="border-top: 2px solid #000; margin-top: 10px; padding-top: 4px; font-size: 11px; text-align: center;">
    --- AVORA KITCHEN ENGINE ---
  </div>
</div>`,
        };

      case PrintTemplateType.ITEM_LABEL:
        return {
          name: 'Tem nhãn món ăn 50x30mm',
          paperSize: '50x30mm',
          content: `<div style="font-family: Arial, sans-serif; font-size: 10px; line-height: 1.15; color: #000; width: 100%; box-sizing: border-box; text-align: left;">
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding-bottom: 1.5px; margin-bottom: 2px;">
    <b style="font-size: 9.5px; text-transform: uppercase; letter-spacing: -0.2px;">[Ten_Cua_Hang]</b>
    <span style="font-size: 9.5px; font-weight: bold;">[Ten_Ban]</span>
  </div>
  <div style="font-size: 11.5px; font-weight: 900; line-height: 1.15; margin-bottom: 1px; word-break: break-word;">[Ten_Mon_An]</div>
  <div style="font-size: 9px; line-height: 1.15;">[Tuy_Chon_Mon]</div>
  <div style="font-size: 9px; line-height: 1.15; font-style: italic;">[Ghi_Chu_Mon]</div>
  <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #000; margin-top: 2px; padding-top: 1.5px;">
    <span style="font-size: 8px;">[Ngay_Tao]</span>
    <b style="font-size: 10px; white-space: nowrap;">[Don_Gia]</b>
  </div>
</div>`,
        };

      case PrintTemplateType.ONLINE_ORDER:
        return {
          name: 'Hóa đơn đơn hàng Online / Delivery 80mm',
          paperSize: '80mm',
          content: `<div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.35; color: #000; width: 100%; text-align: center;">
  <div style="font-size: 18px; font-weight: bold; text-transform: uppercase;">[Ten_Cua_Hang]</div>
  <div style="font-size: 13px;">[Ten_Chi_Nhanh] - [Dien_Thoai_Chi_Nhanh]</div>
  <div style="border-top: 2px solid #000; margin: 8px 0 4px 0;"></div>
  <div style="font-size: 16px; font-weight: bold; margin: 4px 0;">ĐƠN HÀNG ONLINE / DELIVERY</div>
  <div style="font-size: 13px; font-weight: bold;">Mã đơn: [Ma_Hoa_Don]</div>
  <div style="border-bottom: 1px dashed #000; margin: 6px 0 8px 0;"></div>

  <div style="text-align: left; font-size: 12px; background: #f4f4f4; padding: 6px; border: 1px solid #ddd; margin-bottom: 6px;">
    <div>Người nhận: <b style="font-size: 13px;">[Ten_Khach_Hang]</b></div>
    <div>SĐT: <b style="font-size: 13px;">[Dien_Thoai_Khach_Hang]</b></div>
    <div>Địa chỉ: <b>[Dia_Chi_Giao_Hang]</b></div>
    {{#if note}}<div>Ghi chú: <i>[Ghi_Chu_Don_Hang]</i></div>{{/if}}
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin: 4px 0;">
    <thead>
      <tr style="border-top: 1px solid #000; border-bottom: 1px solid #000;">
        <th style="text-align: left; padding: 4px 0; width: 48%;">Món</th>
        <th style="text-align: center; padding: 4px 0; width: 8%; white-space: nowrap;">SL</th>
        <th style="text-align: right; padding: 4px 0; width: 22%; white-space: nowrap;">Đ.Giá</th>
        <th style="text-align: right; padding: 4px 0; width: 22%; white-space: nowrap;">T.Tiền</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr style="border-bottom: 1px dotted #ccc;">
        <td style="text-align: left; padding: 4px 0; word-break: break-word; overflow-wrap: break-word;">
          <div style="font-weight: bold;">[Ten_Mon_An]</div>
          <div style="font-size: 10px;">[Tuy_Chon_Mon]</div>
        </td>
        <td style="text-align: center; vertical-align: top; padding: 4px 0; font-weight: bold; white-space: nowrap;">[So_Luong]</td>
        <td style="text-align: right; vertical-align: top; padding: 4px 0; white-space: nowrap;">[Don_Gia]</td>
        <td style="text-align: right; vertical-align: top; padding: 4px 0; font-weight: bold; white-space: nowrap;">[Thanh_Tien]</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <table style="width: 100%; font-size: 11.5px; margin-top: 4px; border-collapse: collapse;">
    {{#if vatExclusive}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Tiền hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 2px 0;">Phí giao hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Phi_Giao_Hang]</td>
    </tr>
    {{#if discountVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher món ([Ma_Voucher_Giam_Gia]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Voucher]</td>
    </tr>
    {{/if}}
    {{#if shippingVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher ship ([Ma_Voucher_Freeship]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Freeship]</td>
    </tr>
    {{/if}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Thuế VAT ([Phan_Tram_VAT]):</td>
      <td style="text-align: right; padding: 2px 0; font-weight: bold; white-space: nowrap;">[Tong_VAT]</td>
    </tr>
    [Chi_Tiet_VAT]
    {{/if}}
    {{#if vatInclusive}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Tiền hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 2px 0;">Phí giao hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Phi_Giao_Hang]</td>
    </tr>
    {{#if discountVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher món ([Ma_Voucher_Giam_Gia]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Voucher]</td>
    </tr>
    {{/if}}
    {{#if shippingVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher ship ([Ma_Voucher_Freeship]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Freeship]</td>
    </tr>
    {{/if}}
    <tr>
      <td style="text-align: left; padding: 1.5px 0; font-size: 10.5px; color: #444;">Thuế VAT ([Phan_Tram_VAT] - đã gồm):</td>
      <td style="text-align: right; padding: 1.5px 0; font-size: 10.5px; color: #444; white-space: nowrap;">[Tong_VAT]</td>
    </tr>
    [Chi_Tiet_VAT]
    {{/if}}
    {{#if noVat}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Tiền hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Tam_Tinh]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 2px 0;">Phí giao hàng:</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">[Phi_Giao_Hang]</td>
    </tr>
    {{#if discountVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher món ([Ma_Voucher_Giam_Gia]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Voucher]</td>
    </tr>
    {{/if}}
    {{#if shippingVoucher}}
    <tr>
      <td style="text-align: left; padding: 2px 0;">Voucher ship ([Ma_Voucher_Freeship]):</td>
      <td style="text-align: right; padding: 2px 0; white-space: nowrap;">-[Tien_Giam_Freeship]</td>
    </tr>
    {{/if}}
    {{/if}}
    <tr style="border-top: 1px solid #000; border-bottom: 1px solid #000;">
      <td style="text-align: left; padding: 6px 0; font-size: 15px; font-weight: bold;">TỔNG CỘNG:</td>
      <td style="text-align: right; padding: 6px 0; font-size: 16px; font-weight: bold; white-space: nowrap;">[Tong_Cong]</td>
    </tr>
    <tr>
      <td style="text-align: left; padding: 4px 0;">Thanh toán:</td>
      <td style="text-align: right; padding: 4px 0; font-weight: bold; white-space: nowrap;">[Phuong_Thuc_Thanh_Toan]</td>
    </tr>
    {{#if vatInvoice}}
    <tr style="border-top: 1px dotted #ccc;">
      <td colspan="2" style="text-align: left; padding: 4px 0; font-size: 11px;">
        Xuất HĐ VAT: <b>[Ten_Cong_Ty]</b><br/>
        MST: [Ma_So_Thue] | Email: [Email_Hoa_Don]
        {{#if companyAddress}}<br/>Đ/c: [Dia_Chi_Cong_Ty]{{/if}}
      </td>
    </tr>
    {{/if}}
  </table>

  <div style="margin: 12px 0 6px 0;">
    [Ma_Vach_Hoa_Don]
  </div>
  <div style="font-size: 12px; font-weight: bold;">CẢM ƠN QUÝ KHÁCH ĐÃ ĐẶT HÀNG TẠI AVORA!</div>
</div>`,
        };

      default:
        return {
          name: 'Mẫu in tiêu chuẩn 80mm',
          paperSize: '80mm',
          content: `<div style="font-family: Arial, sans-serif; font-size: 13px;">[Ten_Cua_Hang] - [Ten_Chi_Nhanh]</div>`,
        };
    }
  }
}
