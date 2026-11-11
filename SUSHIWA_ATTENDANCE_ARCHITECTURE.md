# SUSHI WA ATTENDANCE SYSTEM — ARCHITECTURE SPECIFICATION
## Legacy Reverse Engineering Document — AVORA F&B Porting Guide

---

## 1. TỔNG QUAN HỆ THỐNG GỐC (SUSHI WA)

Hệ thống chấm công của SUSHI WA được xây dựng trên nền tảng:
- **Backend:** Java 17+, Spring Boot (Spring MVC, Spring Data JPA, Spring Security, Apache POI 5.x).
- **Frontend Admin:** Thymeleaf templates (`attendance-dashboard.html`, `attendance-qr-display.html`, `static-qr-generator.html`).
- **POS / Waiter Client:** Bootstrap 5, Html5-QRCode (`html5-qrcode.min.js`), FingerprintJS (`HW_` visitorId), HTML5 Geolocation API, WebSocket / SockJS / Stomp.
- **Database:** MySQL / PostgreSQL (JPA Entities: `Shift`, `Attendance`, `AttendanceLog`, `User`, `Branch`, `Role`).

---

## 2. QUY TRÌNH CHẤM CÔNG (END-TO-END FLOW)

```
[Nhân viên Waiter / Mobile]
       │
       ▼
 1. Yêu cầu GPS Geolocation (High Accuracy, timeout 10s)
       │  Lấy: latitude, longitude, accuracy
       ▼
 2. Bật Camera quét mã QR (Chống rung, lọc ống kính Ultrawide/Macro, chọn 1x)
       │  Quét được: chuỗi QR (Động hoặc Tĩnh)
       ▼
 3. Nhận diện phần cứng (FingerprintJS -> HW_<visitorId> hoặc Fallback FB_<timestamp>)
       │
       ▼
 4. Gửi POST /api/employee/scan-qr
       │ Payload: { qrCodeData, latitude, longitude, accuracy, scanType: "AUTO", deviceId }
       │
       ├──► [Backend Server Validation]
       │     1. Xác thực Device:
       │        - Nếu User.registeredDeviceId == null: Đăng ký thiết bị lần đầu, trả về SUCCESS_REGISTERED.
       │        - Kiểm tra thiết bị nếu bật policy (hoặc Admin Reset Device).
       │     2. Xác định trạng thái AUTO:
       │        - Kiểm tra lần chấm công gần nhất trong ngày của User.
       │        - Nếu có checkIn mà chưa có checkOut -> Gán scanType = CHECK_OUT.
       │        - Ngược lại -> Gán scanType = CHECK_IN.
       │     3. Validate Check-in/Check-out State:
       │        - Không cho phép Check-in 2 lần liên tiếp mà chưa Check-out.
       │        - Không cho phép Check-out khi chưa có Check-in hợp lệ.
       │     4. Giải mã và kiểm tra QR:
       │        - Định dạng: 3 phần tách nhau bởi dấu `|`.
       │        - Case A (QR Tĩnh): `STATIC_QR|<branchId>|<sig10>`.
       │          Xác minh MD5("STATIC_QR|" + branchId + "|" + branch.qrSecretKey).substring(0, 10). Không hạn giờ.
       │        - Case B (QR Động): `<branchId>|<timestamp>|<sig10>`.
       │          Xác minh MD5(branchId + "|" + timestamp + "|" + branch.qrSecretKey).substring(0, 10).
       │          Kiểm tra thời hạn: (currentTimestamp - qrTimestamp) nằm trong [-5, +300] giây (5 phút).
       │     5. Kiểm tra GPS Geofence:
       │        - Tính khoảng cách Haversine giữa vị trí nhân viên và tọa độ Branch.
       │        - allowedRadius = min(branch.allowedRadiusMeters || 500, 400.0).
       │        - Nếu accuracy > 300m -> Từ chối ("Tín hiệu GPS quá yếu").
       │        - Nếu distance > allowedRadius:
       │            Nếu distance <= allowedRadius + accuracy -> Lưu log mã WARNING_HIGH_ACCURACY_ERROR.
       │            Nếu distance > allowedRadius + accuracy -> Ném lỗi từ chối chấm công.
       │     6. Phân ca & Tính giờ:
       │        - Role Bếp / Kitchen: Ca tự do (Shift = null, status = FLEXIBLE).
       │        - Role Phục vụ / Khác: Tìm ca phù hợp nhất (ưu tiên ca phân công riêng `assignedUsers`, sau đó ca chung của role, chênh lệch giờ vào <= 120 phút).
       │        - Đi trễ: (actualIn - shiftStart - 3 phút buffer) > gracePeriod -> LATE.
       │        - Về sớm: (shiftEnd - actualOut - 3 phút buffer) > 0 -> EARLY_LEAVE.
       │        - Tính giờ làm thực tế theo độ giao nhau (Overlap calculation).
       │     7. Lưu DB & Log:
       │        - Lưu/Cập nhật bản ghi `Attendance`.
       │        - Lưu vết `AttendanceLog` (Lưu cả thiết bị, GPS, khoảng cách, raw QR, shift name).
       │        - Gửi thông báo đến Quản lý qua Notification / WebSocket.
       │
       ▼
 5. Phản hồi cho Mobile Waiter (Thành công / Cảnh báo Đăng ký máy / Báo lỗi)
```

---

## 3. CƠ CHẾ QR CODE

### 3.1. QR Động (Dynamic QR — Màn hình quầy / Tablet)
- **Chu kỳ sinh:** Frontend polling mỗi 180 giây (hoặc countdown 300 giây).
- **Công thức:** `branchId + "|" + timestamp + "|" + MD5(branchId + "|" + timestamp + "|" + qrSecretKey).substring(0, 10)`
- **Thời hạn hiệu lực:** 300 giây (sai số clock drift cho phép -5 giây đến +300 giây).

### 3.2. QR Tĩnh (Static QR — In biển giấy dán tại quán)
- **Công thức:** `"STATIC_QR|" + branchId + "|" + MD5("STATIC_QR|" + branchId + "|" + qrSecretKey).substring(0, 10)`
- **Thời hạn hiệu lực:** Không bao giờ hết hạn. Được in ở độ phân giải cao Super HD (1600x1800).
- **Bảo mật:** Nhân viên bắt buộc phải có mặt tại quán vì vẫn phải vượt qua bài kiểm tra GPS Geofence (bán kính <= 50-400m).

---

## 4. QUẢN TRỊ ADMIN (5 PHÂN HỆ CHÍNH)

1. **Bảng công (`#history`):** Lưới xem toàn bộ công, lọc theo khoảng thời gian, chi nhánh, vai trò, nhân viên; hỗ trợ Thêm công thủ công (hỗ trợ ca gãy 2 khung giờ), Chỉnh sửa công kèm lý do, Xóa công kèm lý do; tự động ghi vết vào `AttendanceLog`.
2. **Cấu hình lịch ca (`#shifts`):** Danh sách ca làm việc theo ngày và vai trò. Cấu hình giờ bắt đầu, kết thúc, thời gian trễ cho phép (grace period), ca gãy (khung giờ 2), gán danh sách nhân viên cụ thể. Hỗ trợ import lịch ca tuần từ file Excel. Khi sửa/xóa ca, tự động chạy hàm `syncAttendancesWithShifts` để tính lại bảng công.
3. **Ma trận ca làm (`#weekly`):** Bảng hiển thị nhân viên theo chiều dọc và 7 ngày trong tuần theo chiều ngang. Mỗi ô thể hiện tên ca, giờ vào - ra hoặc trạng thái đang làm việc.
4. **Nhật ký GPS & Log (`#logs`):** Toàn bộ nhật ký quét QR của nhân viên và thao tác sửa đổi thủ công của admin. Hiển thị tọa độ GPS, khoảng cách m, độ lệch m, mã lỗi, tên ca, ID thiết bị.
5. **Quản lý thiết bị (`#devices`):** Danh sách nhân viên, thiết bị đã đăng ký (`registeredDeviceId`), nút Reset thiết bị khi nhân viên đổi điện thoại mới.

---

## 5. MÔ TẢ ĐÍCH ĐẾN TẠI AVORA

Hệ thống sẽ được port sang:
- **Backend:** NestJS, TypeScript strict, Prisma ORM, MySQL.
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS, Lucide icons, AVORA Design System (màu đỏ thương hiệu `#b91c1c` / `red-600` / `red-700`).
- **Phân quyền:** Tích hợp RBAC permissions guard (`PermissionsGuard`, `@RequirePermission`).
- **Excel Engine:** `exceljs` tái tạo 100% định dạng, merge cells, màu sắc, font, công thức động liên kết giữa các sheet.

