import { ScopeType, RiskLevel } from '@prisma/client';

export interface PermissionDefinition {
  key: string;
  groupKey: string;
  name: string;
  description: string;
  scopeType: ScopeType;
  riskLevel: RiskLevel;
  sortOrder: number;
}

export interface PermissionGroupDefinition {
  key: string;
  name: string;
  category: string; // TỔNG QUAN, BÁN HÀNG, KHÁCH HÀNG, MARKETING, HỆ THỐNG
  description?: string;
  sortOrder: number;
}

export const PERMISSION_GROUPS: PermissionGroupDefinition[] = [
  // TỔNG QUAN
  { key: 'app', name: 'Quyền truy cập ứng dụng', category: 'TỔNG QUAN', sortOrder: 1 },
  { key: 'dashboard', name: 'Tổng quan (Dashboard)', category: 'TỔNG QUAN', sortOrder: 2 },
  { key: 'reports', name: 'Báo cáo & Thống kê', category: 'TỔNG QUAN', sortOrder: 3 },

  // BÁN HÀNG
  { key: 'pos', name: 'POS Bán hàng & Thu ngân', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 4 },
  { key: 'waiter', name: 'Phục vụ bàn (Waiter)', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 5 },
  { key: 'kitchen', name: 'Bếp & Bar (KDS)', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 6 },
  { key: 'orders', name: 'Quản lý đơn hàng', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 7 },
  { key: 'reservations', name: 'Quản lý đặt bàn', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 8 },
  { key: 'tables', name: 'Sơ đồ bàn & Khu vực', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 9 },
  { key: 'products', name: 'Món ăn & Thực đơn', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 10 },
  { key: 'categories', name: 'Danh mục món ăn', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 11 },
  { key: 'combos', name: 'Combo món ăn', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 12 },

  // KHÁCH HÀNG
  { key: 'customers', name: 'Quản lý khách hàng', category: 'QUẢN LÝ KHÁCH HÀNG', sortOrder: 13 },
  { key: 'staff', name: 'Quản lý nhân sự', category: 'QUẢN LÝ KHÁCH HÀNG', sortOrder: 14 },
  { key: 'attendance', name: 'Chấm công & Lịch ca', category: 'QUẢN LÝ KHÁCH HÀNG', sortOrder: 15 },
  { key: 'roles', name: 'Vai trò & Phân quyền', category: 'QUẢN LÝ KHÁCH HÀNG', sortOrder: 16 },
  { key: 'membership', name: 'Thẻ thành viên & Hội viên', category: 'QUẢN LÝ KHÁCH HÀNG', sortOrder: 16 },
  { key: 'points', name: 'Điểm thưởng tích lũy', category: 'QUẢN LÝ KHÁCH HÀNG', sortOrder: 17 },
  { key: 'reviews', name: 'Đánh giá & Trải nghiệm', category: 'QUẢN LÝ KHÁCH HÀNG', sortOrder: 18 },

  // MARKETING
  { key: 'articles', name: 'Tin tức & Bài viết', category: 'MARKETING', sortOrder: 19 },
  { key: 'comments', name: 'Duyệt bình luận', category: 'MARKETING', sortOrder: 19 },
  { key: 'vouchers', name: 'Mã giảm giá (Vouchers)', category: 'MARKETING', sortOrder: 20 },
  { key: 'flashsales', name: 'Chương trình Flash Sale', category: 'MARKETING', sortOrder: 21 },
  { key: 'farm', name: 'AVORA Farm (Game)', category: 'MARKETING', sortOrder: 22 },

  // HỆ THỐNG
  { key: 'branches', name: 'Quản lý chi nhánh', category: 'QUẢN LÝ HỆ THỐNG', sortOrder: 23 },
  { key: 'operating_slots', name: 'Khung giờ hoạt động', category: 'QUẢN LÝ HỆ THỐNG', sortOrder: 24 },
  { key: 'payment_methods', name: 'Phương thức thanh toán', category: 'QUẢN LÝ HỆ THỐNG', sortOrder: 25 },
  { key: 'printing', name: 'Mẫu in & Trạm in ấn', category: 'QUẢN LÝ HỆ THỐNG', sortOrder: 26 },
  { key: 'settings', name: 'Cài đặt hệ thống', category: 'QUẢN LÝ HỆ THỐNG', sortOrder: 27 },
  { key: 'audit_logs', name: 'Nhật ký hoạt động (Audit)', category: 'QUẢN LÝ HỆ THỐNG', sortOrder: 28 },
  { key: 'cash_shift', name: 'Ca làm việc & Két tiền', category: 'QUẢN LÝ HỆ THỐNG', sortOrder: 29 },
  { key: 'payments', name: 'Thanh toán & Hoàn tiền', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 30 },
  { key: 'invoices', name: 'Hóa đơn & Hóa đơn điện tử', category: 'QUẢN LÝ BÁN HÀNG', sortOrder: 31 },

  // KHO & NGUYÊN LIỆU (PHASE 3)
  { key: 'inventory', name: 'Kho & Quản lý tồn kho', category: 'KHO & NGUYÊN LIỆU', sortOrder: 32 },
  { key: 'recipes', name: 'Công thức & Định mức (BOM)', category: 'KHO & NGUYÊN LIỆU', sortOrder: 33 },
  { key: 'suppliers', name: 'Nhà cung cấp & Giá mua', category: 'KHO & NGUYÊN LIỆU', sortOrder: 34 },
  { key: 'procurement', name: 'Đơn mua & Nhận hàng', category: 'KHO & NGUYÊN LIỆU', sortOrder: 35 },
];

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // 1. APP ACCESS
  { key: 'admin.access', groupKey: 'app', name: 'Truy cập Admin Shell', description: 'Quyền vào khu vực quản trị AVORA', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 1 },
  { key: 'pos.access', groupKey: 'app', name: 'Truy cập POS Bán hàng', description: 'Quyền vào ứng dụng bán hàng tại quầy', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 2 },
  { key: 'waiter.access', groupKey: 'app', name: 'Truy cập Phục vụ bàn', description: 'Quyền vào ứng dụng Waiter đặt bàn/gọi món', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 3 },
  { key: 'kds.access', groupKey: 'app', name: 'Truy cập Bếp & Bar (KDS)', description: 'Quyền vào màn hình điều phối chế biến', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 4 },

  // 2. DASHBOARD
  { key: 'dashboard.view', groupKey: 'dashboard', name: 'Xem Tổng quan', description: 'Xem số liệu thống kê chung tại Dashboard', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 5 },
  { key: 'dashboard.revenue.view', groupKey: 'dashboard', name: 'Xem doanh thu Dashboard', description: 'Xem biểu đồ và số tiền doanh thu tại Dashboard', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 6 },
  { key: 'dashboard.orders.view', groupKey: 'dashboard', name: 'Xem số liệu đơn hàng', description: 'Xem số lượng đơn hàng theo trạng thái', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 7 },
  { key: 'dashboard.customers.view', groupKey: 'dashboard', name: 'Xem số liệu khách hàng', description: 'Xem chỉ số tăng trưởng và lượng khách mới', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 8 },

  // 3. REPORTS
  { key: 'reports.view', groupKey: 'reports', name: 'Xem mục Báo cáo', description: 'Truy cập màn hình báo cáo', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 9 },
  { key: 'reports.revenue.view', groupKey: 'reports', name: 'Xem báo cáo doanh thu', description: 'Xem chi tiết doanh thu, lợi nhuận, hình thức thanh toán', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 10 },
  { key: 'reports.orders.view', groupKey: 'reports', name: 'Xem báo cáo đơn hàng', description: 'Xem thống kê số lượng đơn và khung giờ cao điểm', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 11 },
  { key: 'reports.products.view', groupKey: 'reports', name: 'Xem báo cáo món ăn', description: 'Xem thống kê bán chạy, danh mục phổ biến', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 12 },
  { key: 'reports.customers.view', groupKey: 'reports', name: 'Xem báo cáo khách hàng', description: 'Xem báo cáo phân khúc và chi tiêu của hội viên', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 13 },
  { key: 'reports.staff.view', groupKey: 'reports', name: 'Xem báo cáo nhân sự', description: 'Xem hiệu suất phục vụ và doanh số từng nhân viên', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 14 },
  { key: 'reports.export', groupKey: 'reports', name: 'Xuất dữ liệu báo cáo', description: 'Tải file Excel / CSV báo cáo thống kê', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 15 },

  // 4. POS
  { key: 'pos.order.view', groupKey: 'pos', name: 'Xem đơn hàng POS', description: 'Xem danh sách và chi tiết đơn hàng tại POS', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 16 },
  { key: 'pos.order.create', groupKey: 'pos', name: 'Tạo đơn hàng POS', description: 'Mở đơn mới cho khách tại quầy hoặc mang đi', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 17 },
  { key: 'pos.order.update', groupKey: 'pos', name: 'Cập nhật đơn hàng POS', description: 'Chỉnh sửa đơn hàng đang phục vụ', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 18 },
  { key: 'pos.order.cancel', groupKey: 'pos', name: 'Hủy đơn hàng POS', description: 'Hủy đơn hàng chưa hoàn thành tại quầy', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 19 },
  { key: 'pos.table.open', groupKey: 'pos', name: 'Mở bàn', description: 'Mở bàn mới cho khách vào ngồi', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 20 },
  { key: 'pos.table.change', groupKey: 'pos', name: 'Đổi bàn', description: 'Chuyển toàn bộ order từ bàn này sang bàn khác', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 21 },
  { key: 'pos.table.merge', groupKey: 'pos', name: 'Gộp bàn', description: 'Gộp nhiều bàn đang phục vụ thành một hóa đơn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 22 },
  { key: 'pos.table.split', groupKey: 'pos', name: 'Tách bàn', description: 'Tách một phần món sang bàn hoặc hóa đơn khác', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 23 },
  { key: 'pos.item.add', groupKey: 'pos', name: 'Thêm món vào bàn', description: 'Gọi thêm món ăn hoặc đồ uống vào order', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 24 },
  { key: 'pos.item.update_unsent', groupKey: 'pos', name: 'Sửa món chưa gửi bếp', description: 'Thay đổi số lượng, ghi chú món khi chưa gửi bếp', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 25 },
  { key: 'pos.item.cancel_sent', groupKey: 'pos', name: 'Hủy món đã gửi bếp', description: 'Hủy món ăn sau khi phiếu chế biến đã vào bếp', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 26 },
  { key: 'pos.customer.attach', groupKey: 'pos', name: 'Gán khách hàng vào đơn', description: 'Tìm kiếm và gắn số điện thoại/hội viên vào đơn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 27 },
  { key: 'pos.loyalty.redeem', groupKey: 'pos', name: 'Tiêu điểm hội viên', description: 'Sử dụng điểm tích lũy của khách để giảm trừ tiền', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 28 },
  { key: 'pos.discount.apply', groupKey: 'pos', name: 'Áp dụng giảm giá/Voucher', description: 'Nhập mã khuyến mãi hoặc giảm giá hóa đơn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 29 },
  { key: 'pos.service_charge.manage', groupKey: 'pos', name: 'Quản lý phụ phí đơn', description: 'Thêm hoặc bớt phí dịch vụ vào đơn hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 30 },
  { key: 'pos.payment.view', groupKey: 'pos', name: 'Xem thông tin thanh toán', description: 'Xem chi tiết số tiền cần thu và phương thức', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 31 },
  { key: 'pos.payment.collect', groupKey: 'pos', name: 'Thu tiền', description: 'Nhận tiền mặt, quẹt thẻ hoặc quét mã VietQR', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 32 },
  { key: 'pos.payment.complete', groupKey: 'pos', name: 'Hoàn tất thanh toán', description: 'Chốt hóa đơn và đánh dấu thanh toán thành công', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 33 },
  { key: 'pos.payment.refund', groupKey: 'pos', name: 'Hoàn tiền đơn tại POS', description: 'Thực hiện hoàn trả tiền cho khách hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 34 },
  { key: 'pos.temp_bill.print', groupKey: 'pos', name: 'In tạm tính', description: 'In hóa đơn tạm tính gửi khách kiểm tra', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 35 },
  { key: 'pos.receipt.print', groupKey: 'pos', name: 'In hóa đơn thanh toán', description: 'In hóa đơn chính thức sau thanh toán', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 36 },
  { key: 'pos.kitchen_ticket.reprint', groupKey: 'pos', name: 'In lại phiếu bếp/bar', description: 'Gửi lệnh in lại phiếu làm món xuống quầy bếp', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 37 },
  { key: 'pos.qr_order.process', groupKey: 'pos', name: 'Xử lý đơn QR tại bàn', description: 'Duyệt hoặc từ chối order khách tự quét QR đặt', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 38 },

  // 5. WAITER
  { key: 'waiter.payment.request', groupKey: 'waiter', name: 'Yêu cầu thanh toán', description: 'Gửi yêu cầu thanh toán tới thu ngân (khi không có quyền chốt)', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 39 },

  // 6. KITCHEN / KDS
  { key: 'kitchen.orders.view', groupKey: 'kitchen', name: 'Xem order tại KDS', description: 'Xem danh sách món ăn cần chế biến trên màn hình bếp', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 40 },
  { key: 'kitchen.item.acknowledge', groupKey: 'kitchen', name: 'Tiếp nhận món', description: 'Báo nhận đơn chế biến món', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 41 },
  { key: 'kitchen.item.prepare', groupKey: 'kitchen', name: 'Bắt đầu làm món', description: 'Đánh dấu đang chế biến món ăn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 42 },
  { key: 'kitchen.item.ready', groupKey: 'kitchen', name: 'Báo xong món', description: 'Đánh dấu món ăn đã nấu xong, sẵn sàng ra bàn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 43 },
  { key: 'kitchen.item.cancel', groupKey: 'kitchen', name: 'Báo hết/hủy món từ bếp', description: 'Bếp báo hết nguyên liệu không thể làm món', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 44 },
  { key: 'kitchen.ticket.reprint', groupKey: 'kitchen', name: 'In lại phiếu làm bếp', description: 'In lại vé chế biến tại trạm bếp', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 45 },

  // 7. ORDERS ADMIN
  { key: 'orders.view', groupKey: 'orders', name: 'Xem danh sách đơn hàng', description: 'Xem toàn bộ đơn hàng trong hệ thống quản trị', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 46 },
  { key: 'orders.detail.view', groupKey: 'orders', name: 'Xem chi tiết đơn hàng', description: 'Xem thông tin món, giá trị, thanh toán của đơn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 47 },
  { key: 'orders.status.update', groupKey: 'orders', name: 'Cập nhật trạng thái đơn', description: 'Chuyển đổi trạng thái đơn (chờ xử lý, đang giao, hoàn thành)', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 48 },
  { key: 'orders.cancel', groupKey: 'orders', name: 'Hủy đơn hàng', description: 'Hủy đơn hàng và ghi nhận lý do chi tiết từ quản trị', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 49 },
  { key: 'orders.delete', groupKey: 'orders', name: 'Xóa vĩnh viễn đơn hàng (Nguy hiểm)', description: 'Lưu trữ / xóa vĩnh viễn đơn hàng với xác nhận mã đơn và lý do', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 50 },
  { key: 'orders.restore', groupKey: 'orders', name: 'Khôi phục đơn hàng đã xóa', description: 'Khôi phục đơn hàng đã bị xóa/lưu trữ về trạng thái trước đó', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 51 },
  { key: 'orders.view_audit', groupKey: 'orders', name: 'Xem nhật ký thay đổi đơn (Timeline)', description: 'Xem chi tiết timeline từng hành động phát sinh trên đơn hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 52 },
  { key: 'orders.view_sensitive_audit', groupKey: 'orders', name: 'Xem nhật ký nhạy cảm của đơn', description: 'Xem IP, user agent, correlation ID và metadata kiểm toán', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 53 },
  { key: 'orders.modify_draft', groupKey: 'orders', name: 'Chỉnh sửa đơn nháp', description: 'Thêm bớt món, đổi số lượng khi đơn còn ở trạng thái nháp', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 54 },
  { key: 'orders.modify_payment_method', groupKey: 'orders', name: 'Đổi phương thức thanh toán', description: 'Thay đổi phương thức thanh toán và cập nhật payment intent hợp lệ', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 55 },
  { key: 'orders.modify_invoice', groupKey: 'orders', name: 'Sửa thông tin hóa đơn VAT', description: 'Cập nhật mã số thuế, tên công ty và địa chỉ xuất hóa đơn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 56 },
  { key: 'orders.add_surcharge', groupKey: 'orders', name: 'Thêm phụ phí vào đơn', description: 'Thêm khoản phụ thu khi đơn chưa bị khóa thanh toán', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 57 },
  { key: 'orders.remove_surcharge', groupKey: 'orders', name: 'Xóa phụ phí khỏi đơn', description: 'Xóa bớt phụ phí khi đơn chưa bị khóa thanh toán', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 58 },
  { key: 'orders.discount.apply', groupKey: 'orders', name: 'Sửa giảm giá đơn hàng', description: 'Áp dụng hoặc điều chỉnh mức chiết khấu', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 59 },
  { key: 'orders.refund', groupKey: 'orders', name: 'Hoàn tiền đơn hàng', description: 'Thực hiện hoàn tiền hóa đơn đã thanh toán', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 60 },
  { key: 'orders.customer.update', groupKey: 'orders', name: 'Sửa thông tin khách trên đơn', description: 'Thay đổi người nhận, số điện thoại, địa chỉ giao hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 61 },
  { key: 'orders.service_charge.manage', groupKey: 'orders', name: 'Quản lý phụ phí đơn', description: 'Điều chỉnh phụ phí trên đơn hàng quản trị', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 62 },
  { key: 'orders.export', groupKey: 'orders', name: 'Xuất danh sách đơn hàng', description: 'Xuất báo cáo chi tiết đơn hàng ra Excel', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 63 },
  { key: 'orders.receipt.print', groupKey: 'orders', name: 'In hóa đơn', description: 'In hóa đơn đơn hàng từ quản trị', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 64 },
  { key: 'orders.receipt.reprint', groupKey: 'orders', name: 'In lại hóa đơn', description: 'In lại hóa đơn thanh toán', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 65 },
  { key: 'orders.kitchen_ticket.reprint', groupKey: 'orders', name: 'In lại phiếu bếp', description: 'In lại phiếu bếp từ chi tiết đơn hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 66 },
  { key: 'orders.cancel_unpaid', groupKey: 'orders', name: 'Hủy đơn chưa thanh toán', description: 'Hủy đơn hàng chưa thu tiền và giải phóng tài nguyên hệ thống', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 67 },
  { key: 'orders.view_unpaid_cancellations', groupKey: 'orders', name: 'Xem báo cáo đơn hủy chưa thanh toán', description: 'Xem chi tiết và thống kê các đơn hàng bị hủy khi chưa thu tiền', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 68 },
  { key: 'orders.request_paid_cancellation', groupKey: 'orders', name: 'Yêu cầu hủy hóa đơn đã thanh toán', description: 'Khởi tạo quy trình hủy hóa đơn đã thu tiền và hoàn tiền', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 69 },
  { key: 'orders.approve_paid_cancellation', groupKey: 'orders', name: 'Phê duyệt hủy hóa đơn đã thanh toán', description: 'Xét duyệt đề xuất hủy hóa đơn và cho phép thực hiện hoàn tiền', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 70 },
  { key: 'orders.view_paid_cancellations', groupKey: 'orders', name: 'Xem báo cáo hóa đơn hủy đã thanh toán', description: 'Xem chi tiết và thống kê hóa đơn đã thanh toán bị hủy', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 71 },

  // PAYMENTS & REFUNDS
  { key: 'payments.refund.create', groupKey: 'payments', name: 'Tạo đề xuất hoàn tiền', description: 'Tạo lệnh hoàn tiền cho hóa đơn đã thanh toán', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 72 },
  { key: 'payments.refund.approve', groupKey: 'payments', name: 'Phê duyệt hoàn tiền', description: 'Duyệt lệnh hoàn tiền cho khách', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 73 },
  { key: 'payments.refund.execute', groupKey: 'payments', name: 'Thực thi chi hoàn tiền', description: 'Xuất quỹ tiền mặt hoặc xác nhận chuyển khoản hoàn tiền', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 74 },
  { key: 'payments.refund.view', groupKey: 'payments', name: 'Xem chi tiết hoàn tiền', description: 'Xem lịch sử và chứng từ các giao dịch hoàn tiền', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 75 },

  // INVOICES & TAX ADJUSTMENTS
  { key: 'invoices.cancel', groupKey: 'invoices', name: 'Hủy hóa đơn điện tử', description: 'Thực hiện thủ tục hủy hóa đơn VAT điện tử đã phát hành', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 76 },
  { key: 'invoices.adjust', groupKey: 'invoices', name: 'Điều chỉnh hóa đơn điện tử', description: 'Lập biên bản và hóa đơn điều chỉnh tiền/thuế VAT', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 77 },
  { key: 'invoices.replace', groupKey: 'invoices', name: 'Thay thế hóa đơn điện tử', description: 'Phát hành hóa đơn mới thay thế hóa đơn cũ bị sai sót', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 78 },

  // =========================================================================
  // KHO & NGUYÊN LIỆU (PHASE 3)
  // =========================================================================
  // INVENTORY
  { key: 'inventory.view', groupKey: 'inventory', name: 'Xem tồn kho & Thẻ kho', description: 'Xem số lượng tồn kho, giá trị tồn và lịch sử giao dịch kho', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 301 },
  { key: 'inventory.create', groupKey: 'inventory', name: 'Tạo kho & Vị trí kho', description: 'Thiết lập kho hàng và vị trí lưu trữ tại chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 302 },
  { key: 'inventory.update', groupKey: 'inventory', name: 'Cập nhật thông tin kho', description: 'Chỉnh sửa thông tin kho và quản lý kho', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 303 },
  { key: 'inventory.adjust', groupKey: 'inventory', name: 'Điều chỉnh số lượng tồn kho', description: 'Tạo phiếu điều chỉnh số dư kho thủ công', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 304 },
  { key: 'inventory.transfer', groupKey: 'inventory', name: 'Yêu cầu & Chuyển kho', description: 'Tạo phiếu chuyển nguyên liệu giữa các kho / chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 305 },
  { key: 'inventory.transfer.approve', groupKey: 'inventory', name: 'Phê duyệt chuyển kho', description: 'Duyệt phiếu xuất/nhập điều chuyển nguyên liệu', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 306 },
  { key: 'inventory.stocktake', groupKey: 'inventory', name: 'Kiểm kê kho', description: 'Tạo phiên kiểm kê và nhập số lượng đếm thực tế', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 307 },
  { key: 'inventory.stocktake.approve', groupKey: 'inventory', name: 'Phê duyệt kiểm kê', description: 'Duyệt kết quả chênh lệch kiểm kê và cập nhật sổ kho', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 308 },
  { key: 'inventory.waste.create', groupKey: 'inventory', name: 'Báo cáo hao hụt & Hủy', description: 'Lập phiếu ghi nhận hư hỏng, hết hạn, hao hụt chế biến', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 309 },
  { key: 'inventory.waste.approve', groupKey: 'inventory', name: 'Phê duyệt phiếu hao hụt', description: 'Duyệt hủy nguyên liệu và ghi nhận chi phí hao hụt', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 310 },
  { key: 'ingredients.manage', groupKey: 'inventory', name: 'Quản lý danh mục nguyên liệu', description: 'Thêm, sửa, thiết lập định lượng và đơn vị quy đổi nguyên liệu', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 311 },

  // RECIPES
  { key: 'recipes.view', groupKey: 'recipes', name: 'Xem công thức & Định lượng', description: 'Xem công thức món ăn, thành phần nguyên liệu và giá vốn', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 312 },
  { key: 'recipes.manage', groupKey: 'recipes', name: 'Tạo & Sửa công thức', description: 'Soạn thảo công thức, định lượng nguyên liệu cho món ăn', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 313 },
  { key: 'recipes.approve', groupKey: 'recipes', name: 'Phê duyệt & Ban hành công thức', description: 'Phê duyệt phiên bản công thức chính thức áp dụng', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 314 },

  // SUPPLIERS
  { key: 'suppliers.manage', groupKey: 'suppliers', name: 'Quản lý nhà cung cấp', description: 'Thêm, sửa hồ sơ nhà cung cấp, bảng giá và công nợ', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 315 },

  // PROCUREMENT
  { key: 'purchase_requests.create', groupKey: 'procurement', name: 'Tạo yêu cầu mua hàng (PR)', description: 'Lập đề xuất mua nguyên vật liệu cho chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 316 },
  { key: 'purchase_requests.approve', groupKey: 'procurement', name: 'Duyệt yêu cầu mua hàng', description: 'Phê duyệt đề xuất mua hàng của chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 317 },
  { key: 'purchase_orders.manage', groupKey: 'procurement', name: 'Quản lý đơn đặt hàng (PO)', description: 'Tạo và gửi đơn đặt hàng tới nhà cung cấp', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 318 },
  { key: 'purchase_orders.approve', groupKey: 'procurement', name: 'Phê duyệt đơn đặt hàng', description: 'Duyệt ngân sách và cam kết đơn đặt hàng mua', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.CRITICAL, sortOrder: 319 },
  { key: 'goods_receipts.confirm', groupKey: 'procurement', name: 'Xác nhận nhập kho (GRN)', description: 'Kiểm đếm, ghi nhận lô/HSD và xác nhận nhập kho thực tế', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 320 },

  // INVENTORY REPORTS
  { key: 'inventory.reports.view', groupKey: 'inventory', name: 'Xem báo cáo kho & Food Cost', description: 'Xem báo cáo định giá tồn kho, Food Cost, hao hụt nguyên liệu', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 321 },
  { key: 'inventory.reports.export', groupKey: 'inventory', name: 'Xuất báo cáo kho', description: 'Tải file Excel báo cáo tồn kho, định mức và giá vốn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 322 },

  // 8. RESERVATIONS
  { key: 'reservations.view', groupKey: 'reservations', name: 'Xem danh sách đặt bàn', description: 'Xem lịch khách đặt chỗ trước', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 58 },
  { key: 'reservations.create', groupKey: 'reservations', name: 'Tạo đặt bàn mới', description: 'Ghi nhận khách đặt bàn qua điện thoại/tại quầy', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 59 },
  { key: 'reservations.update', groupKey: 'reservations', name: 'Chỉnh sửa đặt bàn', description: 'Đổi giờ, số người, ghi chú đặt bàn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 60 },
  { key: 'reservations.confirm', groupKey: 'reservations', name: 'Xác nhận đặt bàn', description: 'Duyệt yêu cầu đặt bàn của khách', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 61 },
  { key: 'reservations.cancel', groupKey: 'reservations', name: 'Hủy đặt bàn', description: 'Hủy lịch đặt bàn theo yêu cầu', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 62 },
  { key: 'reservations.checkin', groupKey: 'reservations', name: 'Check-in khách đặt', description: 'Xác nhận khách đã tới nhà hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 63 },
  { key: 'reservations.seat', groupKey: 'reservations', name: 'Xếp bàn cho khách đặt', description: 'Gán bàn cụ thể cho lượt đặt bàn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 64 },
  { key: 'reservations.complete', groupKey: 'reservations', name: 'Hoàn tất đặt bàn', description: 'Đánh dấu lượt đặt bàn đã phục vụ xong', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 65 },
  { key: 'reservations.mark_no_show', groupKey: 'reservations', name: 'Đánh dấu khách vắng mặt', description: 'Ghi nhận khách không đến (No-show)', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 66 },
  { key: 'reservations.blocks.view', groupKey: 'reservations', name: 'Xem khung giờ khóa bàn', description: 'Xem các khoảng thời gian tạm dừng nhận khách', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 67 },
  { key: 'reservations.blocks.manage', groupKey: 'reservations', name: 'Quản lý khóa đặt bàn', description: 'Tạo hoặc xóa khung giờ ngừng nhận đặt bàn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 68 },

  // 9. TABLES & AREAS
  { key: 'tables.view', groupKey: 'tables', name: 'Xem sơ đồ bàn', description: 'Xem danh sách và trạng thái bàn', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 69 },
  { key: 'tables.create', groupKey: 'tables', name: 'Thêm bàn mới', description: 'Tạo bàn mới vào khu vực', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 70 },
  { key: 'tables.update', groupKey: 'tables', name: 'Sửa thông tin bàn', description: 'Đổi tên bàn, số ghế, trạng thái', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 71 },
  { key: 'tables.delete', groupKey: 'tables', name: 'Xóa bàn', description: 'Xóa bàn khỏi chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 72 },
  { key: 'tables.layout.update', groupKey: 'tables', name: 'Cập nhật bố cục sơ đồ bàn', description: 'Kéo thả, căn chỉnh tọa độ bàn trên sơ đồ', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 73 },
  { key: 'areas.view', groupKey: 'tables', name: 'Xem danh sách khu vực', description: 'Xem các khu vực/tầng tại chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 74 },
  { key: 'areas.create', groupKey: 'tables', name: 'Tạo khu vực mới', description: 'Thêm tầng hoặc sảnh mới cho nhà hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 75 },
  { key: 'areas.update', groupKey: 'tables', name: 'Sửa khu vực', description: 'Đổi tên, cấu hình khu vực', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 76 },
  { key: 'areas.delete', groupKey: 'tables', name: 'Xóa khu vực', description: 'Xóa khu vực/tầng khỏi chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 77 },

  // 10. PRODUCTS & CATALOG
  { key: 'products.view', groupKey: 'products', name: 'Xem danh sách món ăn', description: 'Xem toàn bộ thực đơn món ăn', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.NORMAL, sortOrder: 78 },
  { key: 'products.create', groupKey: 'products', name: 'Thêm món ăn mới', description: 'Tạo món ăn mới toàn hệ thống', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 79 },
  { key: 'products.update', groupKey: 'products', name: 'Chỉnh sửa món ăn', description: 'Sửa tên, mô tả, ảnh, giá bán món ăn', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 80 },
  { key: 'products.delete', groupKey: 'products', name: 'Xóa món ăn', description: 'Xóa món ăn khỏi thực đơn hệ thống', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 81 },
  { key: 'products.availability.update', groupKey: 'products', name: 'Bật/tắt trạng thái món', description: 'Bật/tắt còn món hoặc hết món tại chi nhánh', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.NORMAL, sortOrder: 82 },
  { key: 'products.export', groupKey: 'products', name: 'Xuất dữ liệu món ăn', description: 'Xuất toàn bộ dữ liệu món ăn, tùy chọn, máy in ra Excel', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 83 },
  { key: 'products.import', groupKey: 'products', name: 'Nhập dữ liệu món ăn', description: 'Nhập mới hoặc cập nhật hàng loạt món ăn từ file Excel', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 84 },

  // 11. CATEGORIES
  { key: 'categories.view', groupKey: 'categories', name: 'Xem danh mục món', description: 'Xem danh sách các nhóm món ăn', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 83 },
  { key: 'categories.create', groupKey: 'categories', name: 'Tạo danh mục mới', description: 'Thêm danh mục món ăn mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 84 },
  { key: 'categories.update', groupKey: 'categories', name: 'Sửa danh mục', description: 'Đổi tên, thứ tự hiển thị danh mục', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 85 },
  { key: 'categories.delete', groupKey: 'categories', name: 'Xóa danh mục', description: 'Xóa danh mục món ăn', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 86 },

  // 12. COMBOS
  { key: 'combos.view', groupKey: 'combos', name: 'Xem danh sách Combo', description: 'Xem các set combo món ăn', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 87 },
  { key: 'combos.create', groupKey: 'combos', name: 'Tạo Combo món mới', description: 'Thiết lập set combo mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 88 },
  { key: 'combos.update', groupKey: 'combos', name: 'Sửa Combo món', description: 'Cập nhật món trong combo và giá bán', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 89 },
  { key: 'combos.delete', groupKey: 'combos', name: 'Xóa Combo món', description: 'Xóa combo khỏi hệ thống', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 90 },

  // 13. CUSTOMERS
  { key: 'customers.view', groupKey: 'customers', name: 'Xem danh sách khách hàng', description: 'Xem thông tin khách hàng và hội viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 91 },
  { key: 'customers.create', groupKey: 'customers', name: 'Tạo mới khách hàng', description: 'Thêm hồ sơ khách hàng mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 92 },
  { key: 'customers.update', groupKey: 'customers', name: 'Cập nhật thông tin khách', description: 'Sửa thông tin liên hệ, thuế của khách', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 93 },
  { key: 'customers.delete', groupKey: 'customers', name: 'Xóa hồ sơ khách hàng', description: 'Xóa vĩnh viễn tài khoản khách hàng', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 94 },

  // 14. STAFF
  { key: 'staff.view', groupKey: 'staff', name: 'Xem danh sách nhân sự', description: 'Xem hồ sơ danh sách nhân viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 95 },
  { key: 'staff.create', groupKey: 'staff', name: 'Tạo mới nhân sự', description: 'Tạo tài khoản làm việc cho nhân viên mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 96 },
  { key: 'staff.update', groupKey: 'staff', name: 'Sửa thông tin nhân sự', description: 'Cập nhật hồ sơ, số điện thoại nhân viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 97 },
  { key: 'staff.lock', groupKey: 'staff', name: 'Khóa tài khoản nhân sự', description: 'Vô hiệu hóa quyền đăng nhập của nhân viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 98 },
  { key: 'staff.unlock', groupKey: 'staff', name: 'Mở khóa tài khoản', description: 'Khôi phục quyền đăng nhập của nhân viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 99 },
  { key: 'staff.branches.assign', groupKey: 'staff', name: 'Gán chi nhánh làm việc', description: 'Phân bổ chi nhánh công tác cho nhân viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 100 },
  { key: 'staff.roles.assign', groupKey: 'staff', name: 'Gán vai trò phân quyền', description: 'Cấp quyền hoặc đổi vai trò cho nhân viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 101 },

  // ATTENDANCE & SHIFTS (Hệ thống chấm công Sushi Wa Porting)
  { key: 'attendance.view', groupKey: 'attendance', name: 'Xem bảng công & ca làm', description: 'Xem danh sách chấm công và lịch ca', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 101.1 },
  { key: 'attendance.edit', groupKey: 'attendance', name: 'Thêm, sửa, xóa chấm công & ca', description: 'Chỉnh sửa bảng công thủ công, cấu hình ca', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 101.2 },
  { key: 'attendance.export', groupKey: 'attendance', name: 'Xuất Excel bảng công', description: 'Xuất file Excel báo cáo chấm công chuẩn HR', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 101.3 },
  { key: 'attendance.import', groupKey: 'attendance', name: 'Import lịch ca & công', description: 'Import file Excel lịch ca tuần hoặc dữ liệu lịch sử', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 101.4 },
  { key: 'attendance.log.view', groupKey: 'attendance', name: 'Xem nhật ký GPS & log', description: 'Xem chi tiết nhật ký chấm công, GPS và audit', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 101.5 },
  { key: 'attendance.device.manage', groupKey: 'attendance', name: 'Quản lý thiết bị chấm công', description: 'Xem danh sách thiết bị và reset máy cho nhân viên', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 101.6 },
  { key: 'attendance.qr.manage', groupKey: 'attendance', name: 'Quản lý mã QR chấm công', description: 'Quản lý và hiển thị QR động / tĩnh tại chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 101.7 },

  // 15. ROLES
  { key: 'roles.view', groupKey: 'roles', name: 'Xem danh sách vai trò', description: 'Xem các vai trò và quyền hạn trong hệ thống', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 102 },
  { key: 'roles.create', groupKey: 'roles', name: 'Tạo vai trò mới', description: 'Tạo vai trò tùy chỉnh mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 103 },
  { key: 'roles.update', groupKey: 'roles', name: 'Chỉnh sửa vai trò & quyền', description: 'Thay đổi các quyền được cấp cho vai trò', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 104 },
  { key: 'roles.delete', groupKey: 'roles', name: 'Xóa vai trò', description: 'Xóa vai trò tùy chỉnh khỏi hệ thống', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 105 },
  { key: 'roles.assign', groupKey: 'roles', name: 'Phân bổ quyền cho vai trò', description: 'Cấp phát và thu hồi quyền trong vai trò', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 106 },

  // 16. MEMBERSHIP & POINTS
  { key: 'membership.view', groupKey: 'membership', name: 'Xem hạng thành viên', description: 'Xem danh sách các tier thẻ hội viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 107 },
  { key: 'membership.create', groupKey: 'membership', name: 'Tạo hạng thẻ mới', description: 'Thêm cấp bậc hội viên mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 108 },
  { key: 'membership.update', groupKey: 'membership', name: 'Sửa hạng thành viên', description: 'Cập nhật điều kiện chi tiêu và ưu đãi của hạng', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 109 },
  { key: 'membership.delete', groupKey: 'membership', name: 'Xóa hạng thành viên', description: 'Xóa hạng thẻ thành viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 110 },
  { key: 'points.view', groupKey: 'points', name: 'Xem lịch sử tích điểm', description: 'Xem giao dịch điểm thưởng của hội viên', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 111 },
  { key: 'points.adjust', groupKey: 'points', name: 'Cộng/trừ điểm thủ công', description: 'Điều chỉnh điểm thưởng hội viên thủ công', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 112 },

  // 17. ARTICLES & MARKETING
  { key: 'articles.view', groupKey: 'articles', name: 'Xem danh sách bài viết', description: 'Xem các bài viết tin tức, khuyến mãi', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 113 },
  { key: 'articles.create', groupKey: 'articles', name: 'Tạo bài viết mới', description: 'Soạn thảo và tạo tin tức mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 114 },
  { key: 'articles.update', groupKey: 'articles', name: 'Sửa nội dung bài viết', description: 'Chỉnh sửa nội dung, ảnh bìa tin tức', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 115 },
  { key: 'articles.delete', groupKey: 'articles', name: 'Xóa bài viết', description: 'Xóa tin tức khỏi website', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 116 },
  { key: 'articles.publish', groupKey: 'articles', name: 'Xuất bản bài viết', description: 'Đăng tải hoặc thu hồi bài viết công khai', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 117 },
  { key: 'article_campaigns.view', groupKey: 'articles', name: 'Xem chiến dịch thông báo', description: 'Xem danh sách các chiến dịch gửi thông báo', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 118 },
  { key: 'article_campaigns.send', groupKey: 'articles', name: 'Gửi thông báo đẩy', description: 'Phát sóng thông báo tới toàn bộ người dùng', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 119 },
  { key: 'comments.view', groupKey: 'comments', name: 'Xem bình luận', description: 'Xem danh sách bình luận của khách', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 120 },
  { key: 'comments.moderate', groupKey: 'comments', name: 'Kiểm duyệt bình luận', description: 'Duyệt, ẩn hoặc xóa các bình luận không phù hợp', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 121 },
  { key: 'vouchers.view', groupKey: 'vouchers', name: 'Xem danh sách Voucher', description: 'Xem các mã giảm giá hiện có', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 122 },
  { key: 'vouchers.create', groupKey: 'vouchers', name: 'Tạo Voucher mới', description: 'Phát hành mã khuyến mãi mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 123 },
  { key: 'vouchers.update', groupKey: 'vouchers', name: 'Sửa mã Voucher', description: 'Điều chỉnh hạn dùng, số lượng, điều kiện mã', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 124 },
  { key: 'vouchers.delete', groupKey: 'vouchers', name: 'Xóa mã Voucher', description: 'Xóa mã giảm giá', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 125 },
  { key: 'flashsales.view', groupKey: 'flashsales', name: 'Xem Flash Sale', description: 'Xem danh sách các đợt Flash Sale', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 126 },
  { key: 'flashsales.create', groupKey: 'flashsales', name: 'Tạo đợt Flash Sale', description: 'Lên lịch đợt giảm giá giờ vàng', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 127 },
  { key: 'flashsales.update', groupKey: 'flashsales', name: 'Sửa Flash Sale', description: 'Thay đổi sản phẩm, số lượng trong Flash Sale', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 128 },
  { key: 'flashsales.delete', groupKey: 'flashsales', name: 'Xóa Flash Sale', description: 'Hủy chương trình Flash Sale', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 129 },

  // 18. BRANCHES
  { key: 'branches.view', groupKey: 'branches', name: 'Xem danh sách chi nhánh', description: 'Xem thông tin các cơ sở nhà hàng', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.NORMAL, sortOrder: 130 },
  { key: 'branches.create', groupKey: 'branches', name: 'Tạo chi nhánh mới', description: 'Khai báo thêm cơ sở nhà hàng mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 131 },
  { key: 'branches.update', groupKey: 'branches', name: 'Sửa thông tin chi nhánh', description: 'Cập nhật địa chỉ, số điện thoại chi nhánh', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.CRITICAL, sortOrder: 132 },
  { key: 'branches.delete', groupKey: 'branches', name: 'Xóa chi nhánh', description: 'Xóa vĩnh viễn một chi nhánh', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 133 },
  { key: 'operating_slots.view', groupKey: 'operating_slots', name: 'Xem khung giờ hoạt động', description: 'Xem ca phục vụ của chi nhánh', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.NORMAL, sortOrder: 134 },
  { key: 'operating_slots.create', groupKey: 'operating_slots', name: 'Thêm khung giờ', description: 'Thêm ca mở cửa phục vụ mới', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.SENSITIVE, sortOrder: 135 },
  { key: 'operating_slots.update', groupKey: 'operating_slots', name: 'Sửa khung giờ', description: 'Cập nhật thời gian bắt đầu/kết thúc ca', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.SENSITIVE, sortOrder: 136 },
  { key: 'operating_slots.delete', groupKey: 'operating_slots', name: 'Xóa khung giờ', description: 'Xóa khung giờ hoạt động', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.SENSITIVE, sortOrder: 137 },
  { key: 'branch_special_hours.view', groupKey: 'operating_slots', name: 'Xem ngày lễ/đặc biệt', description: 'Xem lịch đóng cửa hoặc ngày lễ', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.NORMAL, sortOrder: 138 },
  { key: 'branch_special_hours.manage', groupKey: 'operating_slots', name: 'Cấu hình ngày đặc biệt', description: 'Thiết lập ngày lễ, lịch nghỉ bất thường', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.SENSITIVE, sortOrder: 139 },

  // 19. PAYMENT METHODS
  { key: 'payment_methods.view', groupKey: 'payment_methods', name: 'Xem phương thức thanh toán', description: 'Xem danh sách cổng và hình thức thanh toán', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 140 },
  { key: 'payment_methods.create', groupKey: 'payment_methods', name: 'Thêm phương thức mới', description: 'Tạo phương thức thanh toán mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 141 },
  { key: 'payment_methods.update', groupKey: 'payment_methods', name: 'Sửa phương thức thanh toán', description: 'Bật/tắt, đổi tên hình thức thanh toán', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 142 },
  { key: 'payment_methods.delete', groupKey: 'payment_methods', name: 'Xóa phương thức thanh toán', description: 'Xóa phương thức thanh toán', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 143 },
  { key: 'payment_methods.credentials.manage', groupKey: 'payment_methods', name: 'Quản lý API Key & Bí mật', description: 'Xem và cấu hình Secret Key các cổng thanh toán', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 144 },

  // 20. PRINTING
  { key: 'print_templates.view', groupKey: 'printing', name: 'Xem mẫu in', description: 'Xem danh sách mẫu in hóa đơn và bếp', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 145 },
  { key: 'print_templates.create', groupKey: 'printing', name: 'Tạo mẫu in mới', description: 'Thiết kế mẫu in mới', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 146 },
  { key: 'print_templates.update', groupKey: 'printing', name: 'Chỉnh sửa mẫu in', description: 'Thay đổi mẫu in, thẻ nhúng HTML', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 147 },
  { key: 'print_templates.delete', groupKey: 'printing', name: 'Xóa mẫu in', description: 'Xóa mẫu in khỏi hệ thống', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 148 },
  { key: 'print_templates.history.view', groupKey: 'printing', name: 'Xem lịch sử mẫu in', description: 'Xem các phiên bản sửa đổi trước đây', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 149 },
  { key: 'print_templates.restore', groupKey: 'printing', name: 'Khôi phục phiên bản mẫu in', description: 'Phục hồi lại thiết kế mẫu in cũ', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 150 },
  { key: 'printers.view', groupKey: 'printing', name: 'Xem danh sách máy in', description: 'Xem các máy in đã kết nối', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 151 },
  { key: 'printers.create', groupKey: 'printing', name: 'Thêm máy in mới', description: 'Khai báo máy in hóa đơn/bếp mới', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 152 },
  { key: 'printers.update', groupKey: 'printing', name: 'Sửa cấu hình máy in', description: 'Cập nhật cổng kết nối, khổ giấy', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 153 },
  { key: 'printers.delete', groupKey: 'printing', name: 'Xóa máy in', description: 'Ngắt kết nối máy in khỏi chi nhánh', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 154 },
  { key: 'printers.test', groupKey: 'printing', name: 'In thử nghiệm máy in', description: 'Gửi lệnh in test kiểm tra thiết bị', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 155 },
  { key: 'print_routes.view', groupKey: 'printing', name: 'Xem luồng định tuyến in', description: 'Xem cấu hình gửi món sang từng máy in', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 156 },
  { key: 'print_routes.update', groupKey: 'printing', name: 'Cấu hình luồng in món', description: 'Chỉ định món ăn nào in ra máy in nào', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 157 },
  { key: 'kitchen_settings.view', groupKey: 'printing', name: 'Xem trạm bếp', description: 'Xem các trạm Bếp Nóng, Bếp Lạnh, Quầy Bar', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 158 },
  { key: 'kitchen_settings.update', groupKey: 'printing', name: 'Cập nhật trạm bếp', description: 'Cấu hình và phân chia trạm chế biến', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 159 },

  // 21. SETTINGS
  { key: 'settings.general.view', groupKey: 'settings', name: 'Xem cài đặt chung', description: 'Xem tên nhà hàng, logo, hotline', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 160 },
  { key: 'settings.general.update', groupKey: 'settings', name: 'Sửa cài đặt chung', description: 'Cập nhật thông tin nhận diện thương hiệu', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 161 },
  { key: 'settings.vat.view', groupKey: 'settings', name: 'Xem tỷ lệ VAT', description: 'Xem mức thuế suất giá trị gia tăng', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 162 },
  { key: 'settings.vat.update', groupKey: 'settings', name: 'Sửa tỷ lệ thuế VAT', description: 'Cập nhật thuế VAT toàn hệ thống', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 163 },
  { key: 'settings.shipping.view', groupKey: 'settings', name: 'Xem phí giao hàng', description: 'Xem bảng giá ship và đối tác vận chuyển', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 164 },
  { key: 'settings.shipping.update', groupKey: 'settings', name: 'Sửa phí giao hàng', description: 'Cập nhật bảng giá cước giao hàng', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 165 },
  { key: 'settings.pos.view', groupKey: 'settings', name: 'Xem cài đặt POS', description: 'Xem cấu hình tự động mở két, in bill', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 166 },
  { key: 'settings.pos.update', groupKey: 'settings', name: 'Sửa cài đặt POS', description: 'Thay đổi tham số vận hành phần mềm POS', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 167 },
  { key: 'settings.printing.view', groupKey: 'settings', name: 'Xem cài đặt in ấn', description: 'Xem quy tắc in phiếu của chi nhánh', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.NORMAL, sortOrder: 168 },
  { key: 'settings.printing.update', groupKey: 'settings', name: 'Sửa cài đặt in ấn', description: 'Bật/tắt tự động in hóa đơn, phiếu tạm', scopeType: ScopeType.MIXED, riskLevel: RiskLevel.SENSITIVE, sortOrder: 169 },
  { key: 'settings.reservation.view', groupKey: 'settings', name: 'Xem cài đặt đặt bàn', description: 'Xem sức chứa, thời lượng slot đặt bàn', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 170 },
  { key: 'settings.reservation.update', groupKey: 'settings', name: 'Sửa cài đặt đặt bàn', description: 'Cập nhật khoảng cách slot, thời gian giữ chỗ', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 171 },

  // 22. AUDIT LOGS
  { key: 'audit_logs.view', groupKey: 'audit_logs', name: 'Xem nhật ký hoạt động', description: 'Xem nhật ký kiểm toán hành vi quản trị', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 172 },
  { key: 'audit_logs.export', groupKey: 'audit_logs', name: 'Xuất nhật ký kiểm toán', description: 'Xuất dữ liệu lịch sử thao tác ra file', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 173 },

  // 23. CASH SHIFT
  { key: 'cash_shift.view', groupKey: 'cash_shift', name: 'Xem ca thu ngân', description: 'Xem tình trạng ca mở/đóng và số dư két', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 174 },
  { key: 'cash_shift.open', groupKey: 'cash_shift', name: 'Mở ca làm việc', description: 'Bắt đầu ca thu ngân và ghi nhận tiền đầu ca', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 175 },
  { key: 'cash_shift.close', groupKey: 'cash_shift', name: 'Chốt ca làm việc', description: 'Đóng ca, kiểm kê doanh thu và tiền thực tế trong két', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 176 },
  { key: 'cash_shift.history.view', groupKey: 'cash_shift', name: 'Xem lịch sử các ca', description: 'Xem các ca thu ngân trước đây', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 177 },

  // 24. AVORA FARM
  { key: 'farm.view', groupKey: 'farm', name: 'Xem Nông trại AVORA', description: 'Truy cập trung tâm quản trị nông trại', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.NORMAL, sortOrder: 178 },
  { key: 'farm.manage_crop', groupKey: 'farm', name: 'Quản lý cây trồng & hạt', description: 'Thêm, sửa, xóa thông số cây trồng', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 179 },
  { key: 'farm.manage_mutation', groupKey: 'farm', name: 'Quản lý đột biến', description: 'Cấu hình tỷ lệ và biến dị sinh học của cây', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 180 },
  { key: 'farm.manage_event', groupKey: 'farm', name: 'Quản lý sự kiện Farm', description: 'Tạo mùa vụ và lễ hội hoa anh đào/tết', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 181 },
  { key: 'farm.manage_shop', groupKey: 'farm', name: 'Quản lý cửa hàng Farm', description: 'Cấu hình vật phẩm, hạt giống và phân bón', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 182 },
  { key: 'farm.manage_reward', groupKey: 'farm', name: 'Quản lý kho quà đổi thưởng', description: 'Cấu hình đổi điểm loyalty sang voucher', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.CRITICAL, sortOrder: 183 },
  { key: 'farm.view_economy', groupKey: 'farm', name: 'Xem chỉ số kinh tế Farm', description: 'Theo dõi lạm phát coin và tỷ lệ phát hành điểm', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 184 },
  { key: 'farm.view_security', groupKey: 'farm', name: 'Giám sát gian lận Farm', description: 'Xem cảnh báo gian lận và kiểm tra nông trại khách', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 185 },

  // 25. REVIEWS & CUSTOMER EXPERIENCE
  { key: 'reviews.view', groupKey: 'reviews', name: 'Xem danh sách đánh giá', description: 'Xem đánh giá món ăn và đơn hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 186 },
  { key: 'reviews.reply', groupKey: 'reviews', name: 'Phản hồi đánh giá', description: 'Gửi phản hồi chính thức từ AVORA tới khách hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.NORMAL, sortOrder: 187 },
  { key: 'reviews.moderate', groupKey: 'reviews', name: 'Kiểm duyệt đánh giá', description: 'Ẩn hoặc khôi phục đánh giá của khách hàng', scopeType: ScopeType.BRANCH, riskLevel: RiskLevel.SENSITIVE, sortOrder: 188 },
  { key: 'reviews.settings', groupKey: 'reviews', name: 'Cài đặt đánh giá & điểm thưởng', description: 'Cấu hình điểm thưởng và thời hạn đánh giá đơn', scopeType: ScopeType.GLOBAL, riskLevel: RiskLevel.SENSITIVE, sortOrder: 189 },
];

export const SYSTEM_ROLE_CODES = {
  ADMIN: 'ADMIN',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  BRANCH_STAFF: 'BRANCH_STAFF',
  BRANCH_WAITER: 'BRANCH_WAITER',
  BRANCH_KITCHEN: 'BRANCH_KITCHEN',
} as const;

export type SystemRoleCode = typeof SYSTEM_ROLE_CODES[keyof typeof SYSTEM_ROLE_CODES];

export const SYSTEM_ROLES_DEFINITION: {
  code: SystemRoleCode;
  name: string;
  description: string;
  scopeType: ScopeType;
}[] = [
  {
    code: SYSTEM_ROLE_CODES.ADMIN,
    name: 'Admin toàn quyền',
    description: 'Toàn quyền quản trị và cấu hình toàn bộ hệ thống AVORA trên tất cả chi nhánh.',
    scopeType: ScopeType.GLOBAL,
  },
  {
    code: SYSTEM_ROLE_CODES.BRANCH_MANAGER,
    name: 'Quản lý chi nhánh',
    description: 'Quản lý vận hành toàn diện tại chi nhánh được phân công hoặc tất cả chi nhánh.',
    scopeType: ScopeType.BRANCH,
  },
  {
    code: SYSTEM_ROLE_CODES.BRANCH_STAFF,
    name: 'Nhân viên chi nhánh',
    description: 'Thu ngân, bán hàng tại quầy POS, xử lý đơn hàng và thanh toán theo chi nhánh.',
    scopeType: ScopeType.BRANCH,
  },
  {
    code: SYSTEM_ROLE_CODES.BRANCH_WAITER,
    name: 'Phục vụ chi nhánh',
    description: 'Mở bàn, ghi nhận món ăn, đổi bàn và phục vụ khách tại bàn theo chi nhánh.',
    scopeType: ScopeType.BRANCH,
  },
  {
    code: SYSTEM_ROLE_CODES.BRANCH_KITCHEN,
    name: 'Bếp chi nhánh',
    description: 'Tiếp nhận đơn gọi món và cập nhật trạng thái chế biến tại màn hình KDS theo chi nhánh.',
    scopeType: ScopeType.BRANCH,
  },
];

// Helper tính toán danh sách quyền mặc định cho từng System Role
export const DEFAULT_SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleCode, string[]> = {
  // 1. ADMIN: Toàn quyền 100%
  ADMIN: PERMISSIONS_CATALOG.map((p) => p.key),

  // 2. BRANCH_MANAGER: Các quyền nghiệp vụ chi nhánh
  BRANCH_MANAGER: [
    'admin.access',
    'pos.access',
    'waiter.access',
    'kds.access',
    'dashboard.view',
    'dashboard.revenue.view',
    'dashboard.orders.view',
    'dashboard.customers.view',
    'reports.view',
    'reports.revenue.view',
    'reports.orders.view',
    'reports.products.view',
    'reports.customers.view',
    'reports.staff.view',
    'reports.export',
    'pos.order.view',
    'pos.order.create',
    'pos.order.update',
    'pos.order.cancel',
    'pos.table.open',
    'pos.table.change',
    'pos.table.merge',
    'pos.table.split',
    'pos.item.add',
    'pos.item.update_unsent',
    'pos.item.cancel_sent',
    'pos.customer.attach',
    'pos.loyalty.redeem',
    'pos.discount.apply',
    'pos.service_charge.manage',
    'pos.payment.view',
    'pos.payment.collect',
    'pos.payment.complete',
    'pos.temp_bill.print',
    'pos.receipt.print',
    'pos.kitchen_ticket.reprint',
    'pos.qr_order.process',
    'waiter.payment.request',
    'kitchen.orders.view',
    'kitchen.item.acknowledge',
    'kitchen.item.prepare',
    'kitchen.item.ready',
    'kitchen.item.cancel',
    'kitchen.ticket.reprint',
    'orders.view',
    'orders.detail.view',
    'orders.status.update',
    'orders.cancel',
    'orders.restore',
    'orders.view_audit',
    'orders.modify_draft',
    'orders.modify_payment_method',
    'orders.modify_invoice',
    'orders.add_surcharge',
    'orders.remove_surcharge',
    'orders.discount.apply',
    'orders.customer.update',
    'orders.service_charge.manage',
    'orders.export',
    'orders.receipt.print',
    'orders.receipt.reprint',
    'orders.kitchen_ticket.reprint',
    'orders.cancel_unpaid',
    'orders.view_unpaid_cancellations',
    'orders.request_paid_cancellation',
    'orders.approve_paid_cancellation',
    'orders.view_paid_cancellations',
    'payments.refund.create',
    'payments.refund.approve',
    'payments.refund.execute',
    'payments.refund.view',
    'invoices.cancel',
    'invoices.adjust',
    'invoices.replace',
    'reservations.view',
    'reservations.create',
    'reservations.update',
    'reservations.confirm',
    'reservations.cancel',
    'reservations.checkin',
    'reservations.seat',
    'reservations.complete',
    'reservations.mark_no_show',
    'reservations.blocks.view',
    'reservations.blocks.manage',
    'tables.view',
    'tables.create',
    'tables.update',
    'tables.layout.update',
    'areas.view',
    'areas.create',
    'areas.update',
    'products.view',
    'products.availability.update',
    'products.export',
    'products.import',
    'categories.view',
    'combos.view',
    'customers.view',
    'customers.create',
    'customers.update',
    'staff.view',
    'attendance.view',
    'attendance.edit',
    'attendance.export',
    'attendance.import',
    'attendance.log.view',
    'attendance.device.manage',
    'attendance.qr.manage',
    'membership.view',
    'points.view',
    'articles.view',
    'comments.view',
    'comments.moderate',
    'vouchers.view',
    'flashsales.view',
    'branches.view',
    'operating_slots.view',
    'operating_slots.create',
    'operating_slots.update',
    'branch_special_hours.view',
    'branch_special_hours.manage',
    'printers.view',
    'printers.create',
    'printers.update',
    'printers.test',
    'print_routes.view',
    'print_routes.update',
    'kitchen_settings.view',
    'kitchen_settings.update',
    'settings.pos.view',
    'settings.printing.view',
    'settings.printing.update',
    'settings.reservation.view',
    'cash_shift.view',
    'cash_shift.open',
    'cash_shift.close',
    'cash_shift.history.view',
    'reviews.view',
    'reviews.reply',
    'reviews.moderate',
    'farm.view',
    // Phase 3 Inventory & Costing
    'inventory.view',
    'inventory.create',
    'inventory.update',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.transfer.approve',
    'inventory.stocktake',
    'inventory.stocktake.approve',
    'inventory.waste.create',
    'inventory.waste.approve',
    'ingredients.manage',
    'recipes.view',
    'recipes.manage',
    'suppliers.manage',
    'purchase_requests.create',
    'purchase_requests.approve',
    'purchase_orders.manage',
    'goods_receipts.confirm',
    'inventory.reports.view',
    'inventory.reports.export',
  ],

  // 3. BRANCH_STAFF: Thu ngân / bán hàng
  BRANCH_STAFF: [
    'pos.access',
    'pos.order.view',
    'pos.order.create',
    'pos.order.update',
    'pos.order.cancel',
    'pos.table.open',
    'pos.table.change',
    'pos.table.merge',
    'pos.table.split',
    'pos.item.add',
    'pos.item.update_unsent',
    'pos.item.cancel_sent',
    'pos.customer.attach',
    'pos.loyalty.redeem',
    'pos.discount.apply',
    'pos.service_charge.manage',
    'pos.payment.view',
    'pos.payment.collect',
    'pos.payment.complete',
    'pos.temp_bill.print',
    'pos.receipt.print',
    'pos.kitchen_ticket.reprint',
    'pos.qr_order.process',
    'tables.view',
    'products.view',
    'products.availability.update',
    'categories.view',
    'combos.view',
    'customers.view',
    'customers.create',
    'reservations.view',
    'reservations.checkin',
    'cash_shift.view',
    'cash_shift.open',
    'cash_shift.close',
    'orders.cancel_unpaid',
    'orders.view_unpaid_cancellations',
    'orders.request_paid_cancellation',
    'payments.refund.create',
    'payments.refund.execute',
    'payments.refund.view',
  ],

  // 4. BRANCH_WAITER: Phục vụ bàn
  BRANCH_WAITER: [
    'waiter.access',
    'pos.access',
    'tables.view',
    'pos.table.open',
    'pos.table.change',
    'pos.table.merge',
    'pos.table.split',
    'pos.order.view',
    'pos.order.create',
    'pos.order.update',
    'pos.item.add',
    'pos.item.update_unsent',
    'pos.temp_bill.print',
    'pos.receipt.print',
    'pos.kitchen_ticket.reprint',
    'waiter.payment.request',
    'pos.qr_order.process',
    'pos.customer.attach',
    'customers.view',
    'customers.create',
    'customers.update',
    'products.view',
    'categories.view',
    'combos.view',
    'vouchers.view',
    'payment_methods.view',
    'reservations.view',
    'reservations.seat',
    'reservations.checkin',
    'orders.view',
    'orders.detail.view',
    'attendance.view',
  ],

  // 5. BRANCH_KITCHEN: Bếp & Bar
  BRANCH_KITCHEN: [
    'kds.access',
    'kitchen.orders.view',
    'kitchen.item.acknowledge',
    'kitchen.item.prepare',
    'kitchen.item.ready',
    'kitchen.item.cancel',
    'kitchen.ticket.reprint',
    'products.view',
    'products.availability.update',
  ],
};

// Backward compatibility map
export const PERMISSIONS = PERMISSIONS_CATALOG.reduce((acc, curr) => {
  const codeKey = curr.key.replace(/\./g, '_').toUpperCase();
  acc[codeKey] = curr.key;
  return acc;
}, {} as Record<string, string>);
