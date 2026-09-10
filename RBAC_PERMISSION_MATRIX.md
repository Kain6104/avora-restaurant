# MA TRẬN PHÂN QUYỀN RBAC ENTERPRISE - AVORA RESTAURANT SYSTEM

> **Tiêu chuẩn**: Backend là nguồn chân lý duy nhất (Backend Authoritative), Mặc định từ chối (Default Deny), Đa vai trò (Multi-Role), Đa chi nhánh (Multi-Branch Scoped).
> **Tổng số quyền hạn**: 177 permissions
> **Tổng số nhóm chức năng**: 28 nhóm
> **Vai trò hệ thống mặc định**: 5 vai trò (ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER, BRANCH_KITCHEN)

---

## 1. Danh sách 5 Vai trò Hệ thống Mặc định (System Roles)

| Mã Vai trò | Tên Vai trò | Phạm vi mặc định | Mô tả |
| :--- | :--- | :--- | :--- |
| **ADMIN** | Quản trị viên hệ thống | `GLOBAL` (Tất cả chi nhánh) | Toàn quyền hệ thống, không thể xóa, không thể tự tước quyền quản trị |
| **BRANCH_MANAGER** | Quản lý chi nhánh | `BRANCH` (`ALL_BRANCHES` hoặc `SELECTED_BRANCHES`) | Điều hành nghiệp vụ, menu, đơn hàng, đặt bàn, xem báo cáo theo chi nhánh |
| **BRANCH_STAFF** | Nhân viên quầy / Thu ngân | `BRANCH` (`SELECTED_BRANCHES`) | Vận hành bán hàng tại quầy POS, mở ca, thanh toán, in bill theo chi nhánh |
| **BRANCH_WAITER** | Nhân viên phục vụ bàn | `BRANCH` (`SELECTED_BRANCHES`) | Mở bàn, gọi món, đổi bàn, in tạm tính qua ứng dụng Waiter |
| **BRANCH_KITCHEN** | Nhân viên Bếp & Bar | `BRANCH` (`SELECTED_BRANCHES`) | Điều phối trạm chế biến KDS, nhận món, hoàn thành món, in lại vé bếp |

---

## 2. Bảng Ma trận Quyền hạn Chi tiết (100% Granular Catalog)

### 1. Nhóm: Quyền truy cập ứng dụng (`app`) - Phân loại: TỔNG QUAN

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `admin.access` | Truy cập Admin Shell | `GLOBAL` | 🟢 NORMAL | `/admin, /admin/pos, /admin/kds` | `WS /pos, GET /auth/me/capabilities` | ADMIN, BRANCH_MANAGER |
| `pos.access` | Truy cập POS Bán hàng | `BRANCH` | 🟢 NORMAL | `/admin, /admin/pos, /admin/kds` | `WS /pos, GET /auth/me/capabilities` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `waiter.access` | Truy cập Phục vụ bàn | `BRANCH` | 🟢 NORMAL | `/admin, /admin/pos, /admin/kds` | `WS /pos, GET /auth/me/capabilities` | ADMIN, BRANCH_MANAGER, BRANCH_WAITER |
| `kds.access` | Truy cập Bếp & Bar (KDS) | `BRANCH` | 🟢 NORMAL | `/admin, /admin/pos, /admin/kds` | `WS /pos, GET /auth/me/capabilities` | ADMIN, BRANCH_MANAGER, BRANCH_KITCHEN |

### 2. Nhóm: Tổng quan (Dashboard) (`dashboard`) - Phân loại: TỔNG QUAN

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard.view` | Xem Tổng quan | `BRANCH` | 🟢 NORMAL | `/admin/dashboard` | `GET /dashboard/*` | ADMIN, BRANCH_MANAGER |
| `dashboard.revenue.view` | Xem doanh thu Dashboard | `BRANCH` | 🟡 SENSITIVE | `/admin/dashboard` | `GET /dashboard/*` | ADMIN, BRANCH_MANAGER |
| `dashboard.orders.view` | Xem số liệu đơn hàng | `BRANCH` | 🟢 NORMAL | `/admin/dashboard` | `GET /dashboard/*` | ADMIN, BRANCH_MANAGER |
| `dashboard.customers.view` | Xem số liệu khách hàng | `BRANCH` | 🟢 NORMAL | `/admin/dashboard` | `GET /dashboard/*` | ADMIN, BRANCH_MANAGER |

### 3. Nhóm: Báo cáo & Thống kê (`reports`) - Phân loại: TỔNG QUAN

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `reports.view` | Xem mục Báo cáo | `BRANCH` | 🟢 NORMAL | `/admin/reports` | `GET /reports/*` | ADMIN, BRANCH_MANAGER |
| `reports.revenue.view` | Xem báo cáo doanh thu | `BRANCH` | 🟡 SENSITIVE | `/admin/reports` | `GET /reports/*` | ADMIN, BRANCH_MANAGER |
| `reports.orders.view` | Xem báo cáo đơn hàng | `BRANCH` | 🟢 NORMAL | `/admin/reports` | `GET /reports/*` | ADMIN, BRANCH_MANAGER |
| `reports.products.view` | Xem báo cáo món ăn | `BRANCH` | 🟢 NORMAL | `/admin/reports` | `GET /reports/*` | ADMIN, BRANCH_MANAGER |
| `reports.customers.view` | Xem báo cáo khách hàng | `BRANCH` | 🟢 NORMAL | `/admin/reports` | `GET /reports/*` | ADMIN, BRANCH_MANAGER |
| `reports.staff.view` | Xem báo cáo nhân sự | `BRANCH` | 🟢 NORMAL | `/admin/reports` | `GET /reports/*` | ADMIN, BRANCH_MANAGER |
| `reports.export` | Xuất dữ liệu báo cáo | `BRANCH` | 🟡 SENSITIVE | `/admin/reports` | `GET /reports/*` | ADMIN, BRANCH_MANAGER |

### 4. Nhóm: POS Bán hàng & Thu ngân (`pos`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pos.order.view` | Xem đơn hàng POS | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.order.create` | Tạo đơn hàng POS | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.order.update` | Cập nhật đơn hàng POS | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.order.cancel` | Hủy đơn hàng POS | `BRANCH` | 🟡 SENSITIVE | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.table.open` | Mở bàn | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `pos.table.change` | Đổi bàn | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `pos.table.merge` | Gộp bàn | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `pos.table.split` | Tách bàn | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.item.add` | Thêm món vào bàn | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `pos.item.update_unsent` | Sửa món chưa gửi bếp | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `pos.item.cancel_sent` | Hủy món đã gửi bếp | `BRANCH` | 🟡 SENSITIVE | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.customer.attach` | Gán khách hàng vào đơn | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.loyalty.redeem` | Tiêu điểm hội viên | `BRANCH` | 🟡 SENSITIVE | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.discount.apply` | Áp dụng giảm giá/Voucher | `BRANCH` | 🟡 SENSITIVE | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.service_charge.manage` | Quản lý phụ phí đơn | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.payment.view` | Xem thông tin thanh toán | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.payment.collect` | Thu tiền | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.payment.complete` | Hoàn tất thanh toán | `BRANCH` | 🟡 SENSITIVE | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.payment.refund` | Hoàn tiền đơn tại POS | `BRANCH` | 🔴 **CRITICAL** | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN |
| `pos.temp_bill.print` | In tạm tính | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `pos.receipt.print` | In hóa đơn thanh toán | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.kitchen_ticket.reprint` | In lại phiếu bếp/bar | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `pos.qr_order.process` | Xử lý đơn QR tại bàn | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST/PUT/GET /pos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |

### 5. Nhóm: Phục vụ bàn (Waiter) (`waiter`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `waiter.payment.request` | Yêu cầu thanh toán | `BRANCH` | 🟢 NORMAL | `/admin/pos/waiter` | `WS /pos, POST /pos/orders/create` | ADMIN, BRANCH_MANAGER, BRANCH_WAITER |

### 6. Nhóm: Bếp & Bar (KDS) (`kitchen`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `kitchen.orders.view` | Xem order tại KDS | `BRANCH` | 🟢 NORMAL | `/admin/kds` | `WS /pos, GET /pos/kitchen/tickets, PATCH /pos/kitchen/items/:id/status` | ADMIN, BRANCH_MANAGER, BRANCH_KITCHEN |
| `kitchen.item.acknowledge` | Tiếp nhận món | `BRANCH` | 🟢 NORMAL | `/admin/kds` | `WS /pos, GET /pos/kitchen/tickets, PATCH /pos/kitchen/items/:id/status` | ADMIN, BRANCH_MANAGER, BRANCH_KITCHEN |
| `kitchen.item.prepare` | Bắt đầu làm món | `BRANCH` | 🟢 NORMAL | `/admin/kds` | `WS /pos, GET /pos/kitchen/tickets, PATCH /pos/kitchen/items/:id/status` | ADMIN, BRANCH_MANAGER, BRANCH_KITCHEN |
| `kitchen.item.ready` | Báo xong món | `BRANCH` | 🟢 NORMAL | `/admin/kds` | `WS /pos, GET /pos/kitchen/tickets, PATCH /pos/kitchen/items/:id/status` | ADMIN, BRANCH_MANAGER, BRANCH_KITCHEN |
| `kitchen.item.cancel` | Báo hết/hủy món từ bếp | `BRANCH` | 🟡 SENSITIVE | `/admin/kds` | `WS /pos, GET /pos/kitchen/tickets, PATCH /pos/kitchen/items/:id/status` | ADMIN, BRANCH_MANAGER, BRANCH_KITCHEN |
| `kitchen.ticket.reprint` | In lại phiếu làm bếp | `BRANCH` | 🟢 NORMAL | `/admin/kds` | `WS /pos, GET /pos/kitchen/tickets, PATCH /pos/kitchen/items/:id/status` | ADMIN, BRANCH_MANAGER, BRANCH_KITCHEN |

### 7. Nhóm: Quản lý đơn hàng (`orders`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `orders.view` | Xem danh sách đơn hàng | `BRANCH` | 🟢 NORMAL | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.detail.view` | Xem chi tiết đơn hàng | `BRANCH` | 🟢 NORMAL | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.status.update` | Cập nhật trạng thái đơn | `BRANCH` | 🟡 SENSITIVE | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.cancel` | Hủy đơn hàng | `BRANCH` | 🟡 SENSITIVE | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.discount.apply` | Sửa giảm giá đơn hàng | `BRANCH` | 🟡 SENSITIVE | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.refund` | Hoàn tiền đơn hàng | `BRANCH` | 🔴 **CRITICAL** | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN |
| `orders.customer.update` | Sửa thông tin khách trên đơn | `BRANCH` | 🟢 NORMAL | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.service_charge.manage` | Quản lý phụ phí đơn | `BRANCH` | 🟢 NORMAL | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.export` | Xuất danh sách đơn hàng | `BRANCH` | 🟡 SENSITIVE | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.receipt.print` | In hóa đơn | `BRANCH` | 🟢 NORMAL | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.receipt.reprint` | In lại hóa đơn | `BRANCH` | 🟢 NORMAL | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |
| `orders.kitchen_ticket.reprint` | In lại phiếu bếp | `BRANCH` | 🟢 NORMAL | `/admin/orders` | `GET/PUT/DELETE /orders/*` | ADMIN, BRANCH_MANAGER |

### 8. Nhóm: Quản lý đặt bàn (`reservations`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `reservations.view` | Xem danh sách đặt bàn | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `reservations.create` | Tạo đặt bàn mới | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER |
| `reservations.update` | Chỉnh sửa đặt bàn | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER |
| `reservations.confirm` | Xác nhận đặt bàn | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER |
| `reservations.cancel` | Hủy đặt bàn | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER |
| `reservations.checkin` | Check-in khách đặt | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `reservations.seat` | Xếp bàn cho khách đặt | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER, BRANCH_WAITER |
| `reservations.complete` | Hoàn tất đặt bàn | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER |
| `reservations.mark_no_show` | Đánh dấu khách vắng mặt | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER |
| `reservations.blocks.view` | Xem khung giờ khóa bàn | `BRANCH` | 🟢 NORMAL | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER |
| `reservations.blocks.manage` | Quản lý khóa đặt bàn | `BRANCH` | 🟡 SENSITIVE | `/admin/reservations` | `GET/POST/PUT /admin/reservations/*` | ADMIN, BRANCH_MANAGER |

### 9. Nhóm: Sơ đồ bàn & Khu vực (`tables`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `tables.view` | Xem sơ đồ bàn | `BRANCH` | 🟢 NORMAL | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER |
| `tables.create` | Thêm bàn mới | `BRANCH` | 🟢 NORMAL | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN, BRANCH_MANAGER |
| `tables.update` | Sửa thông tin bàn | `BRANCH` | 🟢 NORMAL | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN, BRANCH_MANAGER |
| `tables.delete` | Xóa bàn | `BRANCH` | 🟡 SENSITIVE | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN |
| `tables.layout.update` | Cập nhật bố cục sơ đồ bàn | `BRANCH` | 🟢 NORMAL | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN, BRANCH_MANAGER |
| `areas.view` | Xem danh sách khu vực | `BRANCH` | 🟢 NORMAL | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN, BRANCH_MANAGER |
| `areas.create` | Tạo khu vực mới | `BRANCH` | 🟢 NORMAL | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN, BRANCH_MANAGER |
| `areas.update` | Sửa khu vực | `BRANCH` | 🟢 NORMAL | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN, BRANCH_MANAGER |
| `areas.delete` | Xóa khu vực | `BRANCH` | 🟡 SENSITIVE | `/admin/tables` | `GET/POST/PUT/DELETE /tables/*` | ADMIN |

### 10. Nhóm: Món ăn & Thực đơn (`products`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `products.view` | Xem danh sách món ăn | `MIXED` | 🟢 NORMAL | `/admin/products` | `GET/POST/PUT/DELETE /products/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_WAITER, BRANCH_KITCHEN |
| `products.create` | Thêm món ăn mới | `GLOBAL` | 🟢 NORMAL | `/admin/products` | `GET/POST/PUT/DELETE /products/*` | ADMIN |
| `products.update` | Chỉnh sửa món ăn | `GLOBAL` | 🟢 NORMAL | `/admin/products` | `GET/POST/PUT/DELETE /products/*` | ADMIN |
| `products.delete` | Xóa món ăn | `GLOBAL` | 🟡 SENSITIVE | `/admin/products` | `GET/POST/PUT/DELETE /products/*` | ADMIN |
| `products.availability.update` | Bật/tắt trạng thái món | `MIXED` | 🟢 NORMAL | `/admin/products` | `GET/POST/PUT/DELETE /products/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF, BRANCH_KITCHEN |

### 11. Nhóm: Danh mục món ăn (`categories`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `categories.view` | Xem danh mục món | `GLOBAL` | 🟢 NORMAL | `/admin/categories` | `GET/POST/PUT/DELETE /categories/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `categories.create` | Tạo danh mục mới | `GLOBAL` | 🟢 NORMAL | `/admin/categories` | `GET/POST/PUT/DELETE /categories/*` | ADMIN |
| `categories.update` | Sửa danh mục | `GLOBAL` | 🟢 NORMAL | `/admin/categories` | `GET/POST/PUT/DELETE /categories/*` | ADMIN |
| `categories.delete` | Xóa danh mục | `GLOBAL` | 🟡 SENSITIVE | `/admin/categories` | `GET/POST/PUT/DELETE /categories/*` | ADMIN |

### 12. Nhóm: Combo món ăn (`combos`) - Phân loại: QUẢN LÝ BÁN HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `combos.view` | Xem danh sách Combo | `GLOBAL` | 🟢 NORMAL | `/admin/combos` | `GET/POST/PUT/DELETE /promotions/combos/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `combos.create` | Tạo Combo món mới | `GLOBAL` | 🟢 NORMAL | `/admin/combos` | `GET/POST/PUT/DELETE /promotions/combos/*` | ADMIN |
| `combos.update` | Sửa Combo món | `GLOBAL` | 🟢 NORMAL | `/admin/combos` | `GET/POST/PUT/DELETE /promotions/combos/*` | ADMIN |
| `combos.delete` | Xóa Combo món | `GLOBAL` | 🟡 SENSITIVE | `/admin/combos` | `GET/POST/PUT/DELETE /promotions/combos/*` | ADMIN |

### 13. Nhóm: Quản lý khách hàng (`customers`) - Phân loại: QUẢN LÝ KHÁCH HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `customers.view` | Xem danh sách khách hàng | `GLOBAL` | 🟢 NORMAL | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `customers.create` | Tạo mới khách hàng | `GLOBAL` | 🟢 NORMAL | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `customers.update` | Cập nhật thông tin khách | `GLOBAL` | 🟡 SENSITIVE | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN, BRANCH_MANAGER |
| `customers.delete` | Xóa hồ sơ khách hàng | `GLOBAL` | 🔴 **CRITICAL** | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN |

### 14. Nhóm: Quản lý nhân sự (`staff`) - Phân loại: QUẢN LÝ KHÁCH HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `staff.view` | Xem danh sách nhân sự | `GLOBAL` | 🟢 NORMAL | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN, BRANCH_MANAGER |
| `staff.create` | Tạo mới nhân sự | `GLOBAL` | 🟡 SENSITIVE | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN |
| `staff.update` | Sửa thông tin nhân sự | `GLOBAL` | 🟡 SENSITIVE | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN |
| `staff.lock` | Khóa tài khoản nhân sự | `GLOBAL` | 🟡 SENSITIVE | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN |
| `staff.unlock` | Mở khóa tài khoản | `GLOBAL` | 🟡 SENSITIVE | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN |
| `staff.branches.assign` | Gán chi nhánh làm việc | `GLOBAL` | 🟡 SENSITIVE | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN |
| `staff.roles.assign` | Gán vai trò phân quyền | `GLOBAL` | 🔴 **CRITICAL** | `/admin/users` | `GET/POST/PUT /users/*` | ADMIN |

### 15. Nhóm: Vai trò & Phân quyền (`roles`) - Phân loại: QUẢN LÝ KHÁCH HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `roles.view` | Xem danh sách vai trò | `GLOBAL` | 🟡 SENSITIVE | `/admin/roles` | `GET/POST/PUT/DELETE /admin/roles/*` | ADMIN |
| `roles.create` | Tạo vai trò mới | `GLOBAL` | 🔴 **CRITICAL** | `/admin/roles` | `GET/POST/PUT/DELETE /admin/roles/*` | ADMIN |
| `roles.update` | Chỉnh sửa vai trò & quyền | `GLOBAL` | 🔴 **CRITICAL** | `/admin/roles` | `GET/POST/PUT/DELETE /admin/roles/*` | ADMIN |
| `roles.delete` | Xóa vai trò | `GLOBAL` | 🔴 **CRITICAL** | `/admin/roles` | `GET/POST/PUT/DELETE /admin/roles/*` | ADMIN |
| `roles.assign` | Phân bổ quyền cho vai trò | `GLOBAL` | 🔴 **CRITICAL** | `/admin/roles` | `GET/POST/PUT/DELETE /admin/roles/*` | ADMIN |

### 16. Nhóm: Thẻ thành viên & Hội viên (`membership`) - Phân loại: QUẢN LÝ KHÁCH HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `membership.view` | Xem hạng thành viên | `GLOBAL` | 🟢 NORMAL | `/admin/memberships` | `GET/POST/PUT/DELETE /membership-tiers/*` | ADMIN, BRANCH_MANAGER |
| `membership.create` | Tạo hạng thẻ mới | `GLOBAL` | 🟡 SENSITIVE | `/admin/memberships` | `GET/POST/PUT/DELETE /membership-tiers/*` | ADMIN |
| `membership.update` | Sửa hạng thành viên | `GLOBAL` | 🟡 SENSITIVE | `/admin/memberships` | `GET/POST/PUT/DELETE /membership-tiers/*` | ADMIN |
| `membership.delete` | Xóa hạng thành viên | `GLOBAL` | 🔴 **CRITICAL** | `/admin/memberships` | `GET/POST/PUT/DELETE /membership-tiers/*` | ADMIN |

### 17. Nhóm: Điểm thưởng tích lũy (`points`) - Phân loại: QUẢN LÝ KHÁCH HÀNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `points.view` | Xem lịch sử tích điểm | `GLOBAL` | 🟢 NORMAL | `/admin/memberships` | `GET/POST /users/:id/points` | ADMIN, BRANCH_MANAGER |
| `points.adjust` | Cộng/trừ điểm thủ công | `GLOBAL` | 🔴 **CRITICAL** | `/admin/memberships` | `GET/POST /users/:id/points` | ADMIN |

### 18. Nhóm: Tin tức & Bài viết (`articles`) - Phân loại: MARKETING

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `articles.view` | Xem danh sách bài viết | `GLOBAL` | 🟢 NORMAL | `/admin/articles` | `GET/POST/PUT/DELETE /admin/articles/*` | ADMIN, BRANCH_MANAGER |
| `articles.create` | Tạo bài viết mới | `GLOBAL` | 🟢 NORMAL | `/admin/articles` | `GET/POST/PUT/DELETE /admin/articles/*` | ADMIN |
| `articles.update` | Sửa nội dung bài viết | `GLOBAL` | 🟢 NORMAL | `/admin/articles` | `GET/POST/PUT/DELETE /admin/articles/*` | ADMIN |
| `articles.delete` | Xóa bài viết | `GLOBAL` | 🟡 SENSITIVE | `/admin/articles` | `GET/POST/PUT/DELETE /admin/articles/*` | ADMIN |
| `articles.publish` | Xuất bản bài viết | `GLOBAL` | 🟡 SENSITIVE | `/admin/articles` | `GET/POST/PUT/DELETE /admin/articles/*` | ADMIN |
| `article_campaigns.view` | Xem chiến dịch thông báo | `GLOBAL` | 🟢 NORMAL | `/admin/articles` | `GET/POST/PUT/DELETE /admin/articles/*` | ADMIN |
| `article_campaigns.send` | Gửi thông báo đẩy | `GLOBAL` | 🟡 SENSITIVE | `/admin/articles` | `GET/POST/PUT/DELETE /admin/articles/*` | ADMIN |

### 19. Nhóm: Duyệt bình luận (`comments`) - Phân loại: MARKETING

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `comments.view` | Xem bình luận | `GLOBAL` | 🟢 NORMAL | `/admin/articles/comments` | `GET/POST/DELETE /admin/article-comments/*` | ADMIN, BRANCH_MANAGER |
| `comments.moderate` | Kiểm duyệt bình luận | `GLOBAL` | 🟢 NORMAL | `/admin/articles/comments` | `GET/POST/DELETE /admin/article-comments/*` | ADMIN, BRANCH_MANAGER |

### 20. Nhóm: Mã giảm giá (Vouchers) (`vouchers`) - Phân loại: MARKETING

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `vouchers.view` | Xem danh sách Voucher | `GLOBAL` | 🟢 NORMAL | `/admin/vouchers` | `GET/POST/PUT/DELETE /promotions/vouchers/*` | ADMIN, BRANCH_MANAGER |
| `vouchers.create` | Tạo Voucher mới | `GLOBAL` | 🟡 SENSITIVE | `/admin/vouchers` | `GET/POST/PUT/DELETE /promotions/vouchers/*` | ADMIN |
| `vouchers.update` | Sửa mã Voucher | `GLOBAL` | 🟡 SENSITIVE | `/admin/vouchers` | `GET/POST/PUT/DELETE /promotions/vouchers/*` | ADMIN |
| `vouchers.delete` | Xóa mã Voucher | `GLOBAL` | 🟡 SENSITIVE | `/admin/vouchers` | `GET/POST/PUT/DELETE /promotions/vouchers/*` | ADMIN |

### 21. Nhóm: Chương trình Flash Sale (`flashsales`) - Phân loại: MARKETING

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `flashsales.view` | Xem Flash Sale | `GLOBAL` | 🟢 NORMAL | `/admin/flash-sales` | `GET/POST/PUT/DELETE /promotions/flash-sales/*` | ADMIN, BRANCH_MANAGER |
| `flashsales.create` | Tạo đợt Flash Sale | `GLOBAL` | 🟡 SENSITIVE | `/admin/flash-sales` | `GET/POST/PUT/DELETE /promotions/flash-sales/*` | ADMIN |
| `flashsales.update` | Sửa Flash Sale | `GLOBAL` | 🟡 SENSITIVE | `/admin/flash-sales` | `GET/POST/PUT/DELETE /promotions/flash-sales/*` | ADMIN |
| `flashsales.delete` | Xóa Flash Sale | `GLOBAL` | 🟡 SENSITIVE | `/admin/flash-sales` | `GET/POST/PUT/DELETE /promotions/flash-sales/*` | ADMIN |

### 22. Nhóm: Quản lý chi nhánh (`branches`) - Phân loại: QUẢN LÝ HỆ THỐNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `branches.view` | Xem danh sách chi nhánh | `MIXED` | 🟢 NORMAL | `/admin/branches` | `GET/POST/PUT/DELETE /admin/branches/*` | ADMIN, BRANCH_MANAGER |
| `branches.create` | Tạo chi nhánh mới | `GLOBAL` | 🔴 **CRITICAL** | `/admin/branches` | `GET/POST/PUT/DELETE /admin/branches/*` | ADMIN |
| `branches.update` | Sửa thông tin chi nhánh | `MIXED` | 🔴 **CRITICAL** | `/admin/branches` | `GET/POST/PUT/DELETE /admin/branches/*` | ADMIN |
| `branches.delete` | Xóa chi nhánh | `GLOBAL` | 🔴 **CRITICAL** | `/admin/branches` | `GET/POST/PUT/DELETE /admin/branches/*` | ADMIN |

### 23. Nhóm: Khung giờ hoạt động (`operating_slots`) - Phân loại: QUẢN LÝ HỆ THỐNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `operating_slots.view` | Xem khung giờ hoạt động | `MIXED` | 🟢 NORMAL | `/admin/operating-slots` | `GET/POST/PUT/DELETE /operating-slots/*` | ADMIN, BRANCH_MANAGER |
| `operating_slots.create` | Thêm khung giờ | `MIXED` | 🟡 SENSITIVE | `/admin/operating-slots` | `GET/POST/PUT/DELETE /operating-slots/*` | ADMIN, BRANCH_MANAGER |
| `operating_slots.update` | Sửa khung giờ | `MIXED` | 🟡 SENSITIVE | `/admin/operating-slots` | `GET/POST/PUT/DELETE /operating-slots/*` | ADMIN, BRANCH_MANAGER |
| `operating_slots.delete` | Xóa khung giờ | `MIXED` | 🟡 SENSITIVE | `/admin/operating-slots` | `GET/POST/PUT/DELETE /operating-slots/*` | ADMIN |
| `branch_special_hours.view` | Xem ngày lễ/đặc biệt | `MIXED` | 🟢 NORMAL | `/admin/operating-slots` | `GET/POST/PUT/DELETE /operating-slots/*` | ADMIN, BRANCH_MANAGER |
| `branch_special_hours.manage` | Cấu hình ngày đặc biệt | `MIXED` | 🟡 SENSITIVE | `/admin/operating-slots` | `GET/POST/PUT/DELETE /operating-slots/*` | ADMIN, BRANCH_MANAGER |

### 24. Nhóm: Phương thức thanh toán (`payment_methods`) - Phân loại: QUẢN LÝ HỆ THỐNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `payment_methods.view` | Xem phương thức thanh toán | `GLOBAL` | 🟢 NORMAL | `/admin/payment-methods` | `GET/POST/PUT/DELETE /payment-methods/*` | ADMIN, BRANCH_MANAGER |
| `payment_methods.create` | Thêm phương thức mới | `GLOBAL` | 🔴 **CRITICAL** | `/admin/payment-methods` | `GET/POST/PUT/DELETE /payment-methods/*` | ADMIN |
| `payment_methods.update` | Sửa phương thức thanh toán | `GLOBAL` | 🔴 **CRITICAL** | `/admin/payment-methods` | `GET/POST/PUT/DELETE /payment-methods/*` | ADMIN |
| `payment_methods.delete` | Xóa phương thức thanh toán | `GLOBAL` | 🔴 **CRITICAL** | `/admin/payment-methods` | `GET/POST/PUT/DELETE /payment-methods/*` | ADMIN |
| `payment_methods.credentials.manage` | Quản lý API Key & Bí mật | `GLOBAL` | 🔴 **CRITICAL** | `/admin/payment-methods` | `GET/POST/PUT/DELETE /payment-methods/*` | ADMIN |

### 25. Nhóm: Mẫu in & Trạm in ấn (`printing`) - Phân loại: QUẢN LÝ HỆ THỐNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `print_templates.view` | Xem mẫu in | `GLOBAL` | 🟢 NORMAL | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |
| `print_templates.create` | Tạo mẫu in mới | `GLOBAL` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN |
| `print_templates.update` | Chỉnh sửa mẫu in | `GLOBAL` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN |
| `print_templates.delete` | Xóa mẫu in | `GLOBAL` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN |
| `print_templates.history.view` | Xem lịch sử mẫu in | `GLOBAL` | 🟢 NORMAL | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN |
| `print_templates.restore` | Khôi phục phiên bản mẫu in | `GLOBAL` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN |
| `printers.view` | Xem danh sách máy in | `BRANCH` | 🟢 NORMAL | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |
| `printers.create` | Thêm máy in mới | `BRANCH` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |
| `printers.update` | Sửa cấu hình máy in | `BRANCH` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |
| `printers.delete` | Xóa máy in | `BRANCH` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN |
| `printers.test` | In thử nghiệm máy in | `BRANCH` | 🟢 NORMAL | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |
| `print_routes.view` | Xem luồng định tuyến in | `BRANCH` | 🟢 NORMAL | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |
| `print_routes.update` | Cấu hình luồng in món | `BRANCH` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |
| `kitchen_settings.view` | Xem trạm bếp | `BRANCH` | 🟢 NORMAL | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |
| `kitchen_settings.update` | Cập nhật trạm bếp | `BRANCH` | 🟡 SENSITIVE | `/admin/settings/print-templates` | `GET/POST/PUT/DELETE /print-routing/*, /print-templates/*` | ADMIN, BRANCH_MANAGER |

### 26. Nhóm: Cài đặt hệ thống (`settings`) - Phân loại: QUẢN LÝ HỆ THỐNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `settings.general.view` | Xem cài đặt chung | `GLOBAL` | 🟢 NORMAL | `/admin/settings` | `GET/PUT /settings/*` | ADMIN, BRANCH_MANAGER |
| `settings.general.update` | Sửa cài đặt chung | `GLOBAL` | 🟡 SENSITIVE | `/admin/settings` | `GET/PUT /settings/*` | ADMIN |
| `settings.vat.view` | Xem tỷ lệ VAT | `GLOBAL` | 🟢 NORMAL | `/admin/settings` | `GET/PUT /settings/*` | ADMIN |
| `settings.vat.update` | Sửa tỷ lệ thuế VAT | `GLOBAL` | 🔴 **CRITICAL** | `/admin/settings` | `GET/PUT /settings/*` | ADMIN |
| `settings.shipping.view` | Xem phí giao hàng | `GLOBAL` | 🟢 NORMAL | `/admin/settings` | `GET/PUT /settings/*` | ADMIN |
| `settings.shipping.update` | Sửa phí giao hàng | `GLOBAL` | 🟡 SENSITIVE | `/admin/settings` | `GET/PUT /settings/*` | ADMIN |
| `settings.pos.view` | Xem cài đặt POS | `GLOBAL` | 🟢 NORMAL | `/admin/settings` | `GET/PUT /settings/*` | ADMIN, BRANCH_MANAGER |
| `settings.pos.update` | Sửa cài đặt POS | `GLOBAL` | 🟡 SENSITIVE | `/admin/settings` | `GET/PUT /settings/*` | ADMIN |
| `settings.printing.view` | Xem cài đặt in ấn | `MIXED` | 🟢 NORMAL | `/admin/settings` | `GET/PUT /settings/*` | ADMIN, BRANCH_MANAGER |
| `settings.printing.update` | Sửa cài đặt in ấn | `MIXED` | 🟡 SENSITIVE | `/admin/settings` | `GET/PUT /settings/*` | ADMIN, BRANCH_MANAGER |
| `settings.reservation.view` | Xem cài đặt đặt bàn | `GLOBAL` | 🟢 NORMAL | `/admin/settings` | `GET/PUT /settings/*` | ADMIN, BRANCH_MANAGER |
| `settings.reservation.update` | Sửa cài đặt đặt bàn | `GLOBAL` | 🟡 SENSITIVE | `/admin/settings` | `GET/PUT /settings/*` | ADMIN |

### 27. Nhóm: Nhật ký hoạt động (Audit) (`audit_logs`) - Phân loại: QUẢN LÝ HỆ THỐNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `audit_logs.view` | Xem nhật ký hoạt động | `GLOBAL` | 🟡 SENSITIVE | `/admin/audit-logs` | `GET /audit-logs/*` | ADMIN |
| `audit_logs.export` | Xuất nhật ký kiểm toán | `GLOBAL` | 🟡 SENSITIVE | `/admin/audit-logs` | `GET /audit-logs/*` | ADMIN |

### 28. Nhóm: Ca làm việc & Két tiền (`cash_shift`) - Phân loại: QUẢN LÝ HỆ THỐNG

| Mã Quyền (`Key`) | Tên quyền | Phạm vi (`Scope`) | Mức rủi ro (`Risk`) | Route Giao diện | Backend API Endpoint | Vai trò mặc định sở hữu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `cash_shift.view` | Xem ca thu ngân | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST /pos/shifts/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `cash_shift.open` | Mở ca làm việc | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST /pos/shifts/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `cash_shift.close` | Chốt ca làm việc | `BRANCH` | 🟡 SENSITIVE | `/admin/pos` | `POST /pos/shifts/*` | ADMIN, BRANCH_MANAGER, BRANCH_STAFF |
| `cash_shift.history.view` | Xem lịch sử các ca | `BRANCH` | 🟢 NORMAL | `/admin/pos` | `POST /pos/shifts/*` | ADMIN, BRANCH_MANAGER |

