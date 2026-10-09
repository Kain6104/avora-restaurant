# MA TRẬN TÍNH NĂNG TOÀN DIỆN: AVORA POS DESKTOP NATIVE
## Single Source of Truth: `/admin/pos` (Web POS) vs AVORA POS Desktop Native

Tài liệu này đối chiếu 1:1 mọi màn hình, modal, drawer, popup, phím tắt, hành động, bộ lọc, trạng thái, quyền RBAC, API endpoint và sự kiện WebSocket từ mã nguồn thực tế của `/admin/pos` sang ứng dụng hoàn toàn mới **AVORA POS Desktop Native** (`AvoraPosNative.exe`).

---

## I. MÀN HÌNH CHÍNH & KHU VỰC LÀM VIỆC (SCREENS & SHELL TABS)

| STT | Tên Màn hình / Tab | Web POS (`/admin/pos`) | Native WPF (`AvoraPosNative`) | API Backend | Quyền RBAC | WebSocket Event | Trạng thái Native |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | **Native Login** | N/A (Web Auth) | `LoginView.xaml` | `POST /api/auth/desktop/login`<br>`GET /api/auth/me`<br>`POST /api/auth/desktop/exchange-code`<br>`POST /api/auth/desktop/exchange-launch-code` | Public / Token check | N/A | PLANNED |
| 2 | **POS Shell** | `PosShell.tsx` | `PosShellView.xaml` | `GET /api/pos/init` | `pos.access` | `join_branch`, `register_pos_terminal` | PLANNED |
| 3 | **Sơ đồ bàn (TABLES)** | `TableMap.tsx` | `TableMapView.xaml` | `GET /api/pos/tables` | `tables.view` | `TABLE_STATUS_CHANGED` | PLANNED |
| 4 | **Bán hàng / Thực đơn (SALE)** | `ProductGrid.tsx`<br>`TouchCategorySidebar.tsx` | `ProductMenuView.xaml` | `GET /api/pos/products` | `pos.access` | `PRODUCT_AVAILABILITY_CHANGED` | PLANNED |
| 5 | **Giỏ hàng đơn hàng (CART)** | `OrderCart.tsx` | `OrderView.xaml` | `POST /api/pos/orders/create`<br>`PUT /api/pos/orders/:id` | `pos.order.create`<br>`pos.order.update` | `ORDER_CREATED`<br>`ORDER_UPDATED` | PLANNED |
| 6 | **Danh sách đơn hàng (ORDERS)** | `OrdersListPanel.tsx` | `OrderListView.xaml` | `GET /api/pos/orders` | `pos.order.view` | `ORDER_UPDATED` | PLANNED |
| 7 | **Bếp / Pha chế (KDS)** | `KitchenKdsPanel.tsx` | `KitchenView.xaml` | `GET /api/pos/kitchen/tickets`<br>`PATCH /api/pos/kitchen/items/:id/status` | `kitchen.orders.view`<br>`kitchen.item.prepare` | `KITCHEN_TICKET_NEW`<br>`KITCHEN_ITEM_UPDATED` | PLANNED |
| 8 | **Lịch Đặt bàn (RESERVATIONS)** | `ReservationPanel.tsx` | `ReservationView.xaml` | `GET /api/pos/reservations`<br>`POST /api/pos/reservations/:id/check-in` | `reservations.view`<br>`reservations.checkin` | N/A | PLANNED |
| 9 | **Lượt gọi món QR (QR_ORDERS)**| `QrOrderPanel.tsx` | `QrOrderView.xaml` | `GET /api/qr-order/admin/branches/:id/qr-rounds/pending`<br>`POST /api/qr-order/admin/rounds/:id/approve`<br>`POST /api/qr-order/admin/rounds/:id/reject` | `pos.qr_order.process` | `QR_ORDER_NEW`<br>`QR_ROUND_SUBMITTED` | PLANNED |
| 10 | **Báo cáo Ca & Hóa đơn (SHIFTS)**| `PosShiftReceiptsView.tsx` | `CashShiftView.xaml` | `GET /api/pos/shifts/current`<br>`GET /api/pos/invoices` | `cash_shift.view` | `SHIFT_UPDATED` | PLANNED |

---

## II. HỘP THOẠI & MODAL NGHIỆP VỤ (MODALS & POPUPS)

| STT | Tên Hộp thoại / Modal | Web POS Source File | Native WPF Dialog File | Chức năng nghiệp vụ & Điều kiện | API / Event liên quan |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 11 | **Chọn số lượng khách** | `GuestCountModal.tsx` | `GuestCountDialog.xaml` | Mở bàn mới hoặc đổi số khách (1-100, phím tắt số nhanh) | DTO `guestCount` |
| 12 | **Tùy chọn món ăn** | `ProductOptionModal.tsx` | `ProductOptionDialog.xaml` | Chọn topping, đường, đá, size, validate min/max và bắt buộc | OptionGroups trong Product |
| 13 | **Chi tiết & ghi chú món** | `ItemDetailModal.tsx` | `ItemDetailDialog.xaml` | Sửa số lượng, đổi ghi chú bếp, chọn trạm in (Bếp/Bar) | Cart item snapshot |
| 14 | **Giảm giá từng món** | `ItemDiscountModal.tsx` | `ItemDiscountDialog.xaml` | Giảm giá theo số tiền cố định (VNĐ) hoặc % kèm lý do | `PUT /api/pos/orders/:id/items/:itemId/discount` |
| 15 | **Giảm giá toàn đơn hàng** | `OrderDiscountModal.tsx` | `OrderDiscountDialog.xaml` | Giảm giá tổng đơn (tiền mặt / %) hoặc nhập Voucher | `discountAmount`, `discountReason` |
| 16 | **Thanh toán tổng hợp** | `PaymentModal.tsx` | `PaymentDialog.xaml` | Tiền mặt, QR VietQR, Thẻ, 2 Voucher đồng thời (Đơn + Ship), Tính tiền thối | `POST /api/pos/orders/:id/pay`<br>`PAYMENT_COMPLETED` |
| 17 | **Hủy món đã gửi bếp** | `CancelItemDialog.xaml` | `CancelItemDialog.xaml` | Hủy món kèm lý do (khách đổi ý, hết nguyên liệu, làm hỏng) | `PATCH /api/pos/kitchen/items/:id/status` |
| 18 | **Hủy toàn bộ đơn hàng** | `CancelOrderModal.tsx` | `CancelOrderDialog.xaml` | Hủy đơn kèm lý do, in phiếu báo hủy bếp tự động | `POST /api/pos/orders/:id/cancel` |
| 19 | **Chuyển bàn (Move Table)** | `MoveTableModal.tsx` | `MoveTableDialog.xaml` | Chuyển đơn sang bàn trống, cập nhật sơ đồ bàn realtime | `POST /api/pos/orders/move-table` |
| 20 | **Gộp bàn (Merge Table)** | `MergeOrderModal.tsx` | `MergeTableDialog.xaml` | Gộp 2 đơn hàng và 2 bàn ăn thành 1 | `POST /api/pos/orders/merge` |
| 21 | **Tách bàn / Tách đơn** | `SplitOrderModal.tsx` | `SplitTableDialog.xaml` | Tách các món đã chọn sang bàn mới hoặc đơn mới | `POST /api/pos/orders/split` |
| 22 | **Chọn / Tìm hội viên** | `CustomerSelectModal.tsx` | `CustomerSelectDialog.xaml` | Tìm kiếm hội viên theo SĐT/Tên, hiển thị điểm, hạng thẻ | `GET /api/pos/customers/search` |
| 23 | **Tạo nhanh khách hàng** | `CreateCustomerModal.tsx` | `CreateCustomerDialog.xaml` | Đăng ký thành viên mới trực tiếp tại máy thu ngân | `POST /api/pos/members` |
| 24 | **Thông tin xuất hóa đơn VAT**| `EditCustomerVatModal.tsx` | `EditCustomerVatDialog.xaml` | Tra cứu MST tự động, nhập tên công ty, địa chỉ, email | `GET /api/pos/tax-lookup/:mst`<br>`PATCH /api/pos/orders/:id/invoice` |
| 25 | **Đổi điểm tích lũy** | `PosRedeemPointsModal.tsx` | `RedeemPointsDialog.xaml` | Dùng điểm tích lũy để giảm giá đơn hoặc nhận món quà tặng | `POST /api/pos/orders/:id/redeem-reward` |
| 26 | **Địa chỉ giao hàng** | `DeliveryAddressModal.tsx` | `DeliveryAddressDialog.xaml` | Tên người nhận, SĐT, địa chỉ, tính phí giao hàng | `PUT /api/pos/orders/:id/fees` |
| 27 | **Áp dụng gói Buffet** | `PosBuffetApplyModal.tsx`<br>`BuffetSelectionModal.tsx` | `BuffetApplyDialog.xaml` | Áp dụng gói buffet, vé buffet, kích hoạt phiên buffet | DTO buffet session |
| 28 | **Quản lý mã QR bàn ăn** | `QrManagementModal.tsx` | `QrManagementDialog.xaml` | Xem QR bàn, cấp lại mã QR mới, vô hiệu hóa mã cũ | `GET /api/qr-order/admin/tables/:id/qr` |
| 29 | **In lại tem nhãn dán ly** | `ReprintLabelsModal.tsx` | `ReprintLabelsDialog.xaml` | In lại tem đồ uống dán ly qua máy in TSPL/ZPL | `POST /api/pos/orders/:id/reprint-labels` |
| 30 | **In lại phiếu bếp** | N/A | `ReprintKitchenDialog.xaml` | In lại phiếu bếp gửi các trạm chế biến | `POST /api/pos/orders/:id/reprint-kitchen` |
| 31 | **Xem hóa đơn tạm tính** | `ProFormaBillModal.tsx` | `ProFormaBillDialog.xaml` | Xem trước bản in tạm tính, in nhiệt đổi trạng thái bàn | In nhiệt ESC/POS |
| 32 | **Mở / Đóng ca làm việc** | `ShiftModal.tsx` | `ShiftDialog.xaml` | Nhập tiền mặt đầu ca, kiểm quỹ cuối ca, tính chênh lệch | `POST /api/pos/shifts/open`<br>`POST /api/pos/shifts/:id/close` |
| 33 | **Bàn phím số cảm ứng** | `NumericKeypadModal.tsx` | `NumericKeypadDialog.xaml` | Bàn phím số nhập tiền khách đưa, số lượng, chiết khấu | Local Touch Event |
| 34 | **Cảnh báo xung đột chỉnh sửa**| `PosConcurrencyLockModal.tsx`| `ConcurrencyLockDialog.xaml` | Cảnh báo khi người khác đang thao tác trên cùng đơn | Order version checking |
| 35 | **Cài đặt thiết bị & máy in** | `PosSettingsDrawer.tsx` | `SettingsView.xaml` | Cấu hình máy in hóa đơn, bếp, bar, tem, khổ giấy, test print | Lưu `appsettings.json` / SQLite |
| 36 | **Command Palette (Ctrl+K)** | `CommandPalette.tsx` | `CommandPaletteDialog.xaml` | Menu lệnh thao tác nhanh bằng bàn phím | Keyboard Shortcut |
| 37 | **Xác nhận thoát an toàn** | `PosExitConfirmModal.tsx` | `ExitDialog.xaml` | Kiểm tra lệnh in dở dang và thoát app sạch | Alt+F4 / Win32 Message Hook |
| 38 | **Cập nhật phần mềm riêng** | `PosUpdateModal.tsx` | `UpdateDialog.xaml` | Tự động kiểm tra bản cập nhật kênh `AVORA_POS_NATIVE` | `GET /api/pos-desktop/update/check?product=AVORA_POS_NATIVE` |

---

## III. NGUYÊN TẮC VOUCHER ĐÔI (DUAL VOUCHERS SUPPORT)

Web POS hỗ trợ 2 loại Voucher đồng thời trong cùng một đơn hàng:
1. **Discount Voucher (`discountVoucherCode`)**: Giảm giá tiền hàng (giảm theo % hoặc số tiền cố định). Được lưu vào trường `discountVoucherCodeSnapshot` và `discountAmount`.
2. **Shipping Voucher (`shippingVoucherCode`)**: Giảm phí giao hàng (áp dụng cho đơn `DELIVERY`). Được lưu vào trường `shippingDiscount` và `shippingDiscountReason`.
-> **Native POS hỗ trợ đầy đủ áp dụng cả 2 voucher cùng lúc** tại `PaymentDialog.xaml` và tính toán giảm trừ chính xác trước khi thanh toán.

---

## IV. BẢNG MAPPING PHÍM TẮT BÀN PHÍM (KEYBOARD SHORTCUTS)

| Phím tắt | Web POS (`usePosShortcuts.ts`) | Native Desktop (`MainWindow.xaml.cs`) | Hành động thực thi |
| :---: | :--- | :--- | :--- |
| **F1** | Chuyển Tab TABLES | Chuyển Tab Sơ Đồ Bàn | Hiển thị sơ đồ bàn ăn toàn nhà hàng |
| **F2** | Chuyển Tab ORDERS | Chuyển Tab Danh Sách Đơn | Xem toàn bộ đơn hàng đang phục vụ / đã xong |
| **F3** | Chuyển Tab KDS | Chuyển Tab Bếp / Pha Chế | Xem màn hình điều phối món bếp |
| **F4** | Chuyển Tab RESERVATIONS | Chuyển Tab Đặt Bàn | Mở bảng quản lý lịch đặt bàn trong ngày |
| **F5** | Chuyển Tab QR_ORDERS | Chuyển Tab Đơn QR | Xem danh sách lượt gọi món khách đặt qua QR |
| **F6** | Mở Modal Ca Thu Ngân | Mở Quản Lý Ca Thu Ngân | Xem trạng thái ca, mở ca, kiểm quỹ đóng ca |
| **F7** | In Tạm Tính | In Tạm Tính (ESC/POS) | In hóa đơn tạm tính cho khách xem trước |
| **F8** | Gửi Bếp | Gửi Bếp (ESC/POS RAW) | Gửi món mới gọi xuống bếp/bar |
| **F9** | Thanh Toán | Mở Hộp Thoại Thanh Toán | Mở PaymentDialog thu tiền |
| **F10** | Cài Đặt POS | Mở Cài Đặt Hệ Thống & In | Cấu hình máy in nhiệt, máy in tem, LAN |
| **F11** | Fullscreen Trình duyệt | Debug Windowed Mode Toggle | Chuyển đổi giữa chế độ Kiosk toàn màn hình & Cửa sổ |
| **Ctrl+F**| Focus ô tìm kiếm món | Focus ô tìm kiếm món Native | Bắt đầu gõ tìm món ăn không cần chuột |
| **Ctrl+K**| Command Palette | Command Palette Dialog | Bật menu tìm kiếm lệnh thao tác nhanh |
| **Escape**| Đóng modal / Hủy chọn | Đóng dialog / Bỏ chọn bàn | Đóng cửa sổ nổi đang mở |
| **Alt+F4**| Chặn / Cảnh báo rời trang | Native Exit Confirm Dialog | Bật ExitDialog xác nhận thoát ứng dụng an toàn |

---

## V. CẤU HÌNH ĐA MÔI TRƯỜNG & KHÔNG HARD-CODE (ZERO HARD-CODING)

Cấu hình máy chủ được nạp theo thứ tự ưu tiên:
1. **Biến môi trường hệ thống:**
   - `AVORA_API_BASE_URL` (hoặc `API_BASE_URL`)
   - `AVORA_WS_BASE_URL` (hoặc `WS_BASE_URL`)
   - `AVORA_BACKEND_URL`
2. **File cấu hình người dùng:** `%LOCALAPPDATA%\AVORA POS Native\Config\appsettings.json`
3. **File cấu hình ứng dụng:** `desktop/AvoraPosNative/appsettings.json`
4. **Giá trị mặc định cục bộ:** `http://127.0.0.1:3001`

---

## VI. HỆ THỐNG IN ẤN NATIVE ĐA MÁY IN (PER-PRINTER WORKER QUEUE)

### 1. Cấu trúc PrinterProfile:
- `printerId`: Mã định danh duy nhất của máy in trong hệ thống.
- `name`: Tên gợi nhớ (VD: "Thu Ngân K80", "Bếp Nóng LAN", "Quầy Bar USB", "Tem Pha Chế").
- `driverName`: Tên driver Windows máy in (VD: "XP-80C", "POS-80", "Xprinter XP-350B").
- `portName`: Cổng kết nối (VD: "USB001", "COM1", "9100").
- `connectionType`: `USB_WINDOWS_SPOOLER` hoặc `TCP_LAN_RAW`.
- `commandSet`: `ESC_POS`, `TSPL`, `ZPL`.
- `dpi`: Độ phân giải (203 DPI tiêu chuẩn máy in nhiệt, 300 DPI).
- `paperWidthMm`: Độ rộng khổ giấy (80mm cho K80, 58mm cho K57, 50mm cho tem nhãn).
- `printableWidthDots`: Số điểm ảnh in được (576 dots cho K80, 384 dots cho K57, 400 dots cho tem).
- `codePage`: Bảng mã ký tự (CP1258 tiếng Việt, CP437, WPC1252, hoặc Raster Bitmap).
- `supportsCut`: Có hỗ trợ lệnh cắt giấy tự động (`0x1D 0x56 0x42 0x00`).
- `supportsDrawer`: Có hỗ trợ cổng kích xung mở két tiền RJ11 (`0x1B 0x70 0x00 0x19 0xFA`).
- `supportsQr`: Hỗ trợ in mã QR (thông qua lệnh native hoặc 1-bit raster).
- `supportsBarcode`: Hỗ trợ in mã vạch Code128 / EAN13.
- `labelCommandLanguage`: `TSPL`, `ZPL`, `EPL`.

### 2. Hàng đợi in độc lập cho từng máy in (Per-Printer Worker Queue):
- **Không dùng chung hàng đợi toàn cục**: Máy in bếp bị nghẽn mạng/hết giấy **tuyệt đối không làm tắc nghẽn** máy in thu ngân hoặc máy in quầy bar.
- Mỗi `printerId` sở hữu một `BlockingCollection` và một `Task` worker riêng biệt chạy nền.

### 3. Bảng SQLite `print_jobs` (Persistent Queue):
```sql
CREATE TABLE IF NOT EXISTS print_jobs (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE NOT NULL,
    printer_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, PRINTING, COMPLETED, FAILED
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    printing_at TEXT,
    printed_at TEXT,
    error TEXT,
    payload_bytes BLOB NOT NULL,
    doc_name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(printer_id, status);
```

---

## VII. ĐÓNG GÓI & PHÂN PHỐI ĐỘC LẬP (SEPARATE OUTPUTS)

| Tiêu chí | App Hybrid Cũ | App Native Mới |
| :--- | :--- | :--- |
| **Thư mục xuất bản App** | `dist/app/` | `dist/native/app/` |
| **Thư mục Installer** | `dist/installer/` | `dist/native/installer/` |
| **File Installer** | `AVORA-POS-Setup.exe` | `AVORA-POS-Native-Setup.exe` |
| **Inno Setup Script** | `installer/avora-pos-setup.iss` | `installer/avora-pos-native-setup.iss` |
| **Kênh Auto Update** | `AVORA_POS` (v1.0.1) | `AVORA_POS_NATIVE` (v1.0.0) |
| **Thư mục cài đặt thực tế** | `%LOCALAPPDATA%\Programs\AVORA POS\` | `%LOCALAPPDATA%\Programs\AVORA POS Native\` |
| **Thư mục dữ liệu người dùng**| `%LOCALAPPDATA%\AVORA POS\` | `%LOCALAPPDATA%\AVORA POS Native\` |
