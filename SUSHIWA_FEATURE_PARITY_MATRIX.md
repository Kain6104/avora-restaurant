# SUSHI WA ATTENDANCE — FEATURE PARITY & IMPLEMENTATION MATRIX
## Full Capability Comparison: Legacy Sushi Wa vs AVORA F&B

---

## 1. MA TRẬN TÍNH NĂNG CHI TIẾT

| STT | Nhóm chức năng | Tính năng chi tiết | Sushi Wa (Java/Thymeleaf) | AVORA (NestJS/Next.js) | Mức độ tương đương |
|---|---|---|---|---|---|
| **I** | **Nhân viên / Mobile Waiter** | | | | |
| 1 | Camera & Quét QR | Tự động chọn camera 1x, lọc ultrawide/macro | Có (`Html5Qrcode`) | Có (Camera Scanner Component) | 100% |
| 2 | Nhận diện thiết bị | Lưu mã phần cứng chống chấm hộ | Có (`FingerprintJS`) | Có (Fingerprint / Local UUID) | 100% |
| 3 | Tọa độ GPS | Lấy tọa độ và kiểm tra sai số accuracy | Có (HTML5 Geolocation) | Có (High Accuracy Geolocation) | 100% |
| 4 | Tự động In/Out | Tự nhận diện vào ca hoặc ra ca | Có (`AUTO`) | Có (`AUTO`) | 100% |
| 5 | Lịch sử cá nhân | Xem danh sách công và thẻ badge trạng thái | Có (Filter + Badges) | Có (Mobile Card + Filter) | 100% |
| 6 | Ma trận tuần nhân viên | Xem lịch chấm công 7 ngày dạng lưới | Có (`fetchMatrixData`) | Có (Matrix Grid Component) | 100% |
| **II**| **Cơ chế QR Chi Nhánh** | | | | |
| 7 | QR Động | Sinh chuỗi băm MD5, đổi mã mỗi 180-300s | Có (`AttendanceController`) | Có (`AttendanceQrService`) | 100% |
| 8 | QR Tĩnh | In biển HD không đổi, dán tại quán | Có (`static-qr-generator`) | Có (Static QR Generator Tool) | 100% |
| 9 | Màn hình QR tại quán | Đồng hồ countdown, bảng hiển thị ai vừa chấm | Có (`attendance-qr-display`) | Có (`/admin/attendance/qr-display`) | 100% |
| 10| Kiểm tra hết hạn QR | Giới hạn mã động tối đa 5 phút | Có (Backend check -5s..300s) | Có (Backend check -5s..300s) | 100% |
| **III**| **Quy tắc Nghiệp vụ Backend** | | | | |
| 11| Geofence Validation | Bán kính 50-400m, tính Haversine | Có (Backend check) | Có (`AttendanceService`) | 100% |
| 12| Phân ca tự động | Ưu tiên ca phân công, dung sai 120 phút | Có (`findClosestShift`) | Có (`findClosestShift`) | 100% |
| 13| Ca tự do (Bếp) | Bỏ qua khung giờ cố định | Có (`FLEXIBLE`) | Có (`FLEXIBLE`) | 100% |
| 14| Tính đi trễ / về sớm | Ân hạn grace period, bù trừ 3 phút | Có (Late / Early calc) | Có (Late / Early calc) | 100% |
| 15| Ca gãy (Split Shift) | 2 khung giờ trong ngày, ghép 2 đợt | Có (`isSplitShift`, `time2`) | Có (`isSplitShift`, `time2`) | 100% |
| 16| Giờ công hiệu quả | Cắt ngoài ca, mở rộng biên độ 3 phút | Có (`calculateShiftOverlap`)| Có (`calculateShiftOverlap`)| 100% |
| 17| Đồng bộ ca - công | Khi sửa ca, tự tính lại công trong ngày | Có (`syncAttendancesWithShifts`)| Có (`syncAttendancesWithShifts`)| 100% |
| 18| Ngày lễ x3 | Bảng lịch âm/dương, nhân 3 giờ chuẩn | Có (`isHoliday`) | Có (`isHoliday`) | 100% |
| **IV**| **Trang Quản trị Admin (5 Tab)**| | | | |
| 19| Tab 1: Bảng công | Xem, lọc, thêm tay, sửa, xóa kèm lý do | Có (`#history`) | Có (`/admin/attendance` Tab 1) | 100% |
| 20| Tab 2: Cấu hình ca | Thêm, sửa, xóa, xóa hàng loạt, import | Có (`#shifts`) | Có (`/admin/attendance` Tab 2) | 100% |
| 21| Tab 3: Ma trận ca làm | Lưới phân công và trạng thái toàn nhân viên | Có (`#weekly`) | Có (`/admin/attendance` Tab 3) | 100% |
| 22| Tab 4: Nhật ký GPS/Log| Bảng log tọa độ, khoảng cách, mã lỗi | Có (`#logs`) | Có (`/admin/attendance` Tab 4) | 100% |
| 23| Tab 5: Quản lý thiết bị | Xem ID thiết bị, nút Reset đổi điện thoại | Có (`#devices`) | Có (`/admin/attendance` Tab 5) | 100% |
| **V** | **Báo cáo & Xuất Nhập Excel** | | | | |
| 24| Sheet Nhật ký chi tiết | 10 cột tổng hợp + 4 cột/ngày | Có (`renderSheetLogChiTiet`) | Có (`AttendanceExcelService`) | 100% |
| 25| Sheet Bảng công Role | Giờ chuẩn, Tăng ca, Ngày lễ x3, Tổng SUM | Có (`renderSheetBangCong`) | Có (`AttendanceExcelService`) | 100% |
| 26| Sheet Phiếu Lương PL | Link công thức động sang Bảng công | Có (`renderSheetPhieuLuong`)| Có (`AttendanceExcelService`) | 100% |
| 27| Import lịch ca tuần | Đọc file Excel ca làm, tự gán nhân viên | Có (`importWeeklySchedule`) | Có (`AttendanceImportService`)| 100% |
| 28| Import công lịch sử | Chuyển đổi dữ liệu cũ từ Sushi Wa sang | Chưa có ở Sushi Wa gốc | **Bổ sung mới trong AVORA** | Mở rộng |
| **VI**| **Phân quyền & Bảo mật** | | | | |
| 29| Kiểm soát truy cập RBAC | 7 quyền chi tiết theo phân hệ | Spring `@PreAuthorize` | NestJS `PermissionsGuard` | 100% |
| 30| Kiểm soát theo Chi nhánh | Quản lý theo phạm vi chi nhánh | Theo Branch ID | Theo AVORA Branch Assignment | 100% |

---

## 2. LỘ TRÌNH TRIỂN KHAI TIẾP THEO

- **Phase 2:** AVORA Database Schema & Backend (Model Prisma, Migration, AttendanceModule, Service, Controller, Guards, Tests).
- **Phase 3:** Waiter Attendance Module (Camera Scanner Modal, Geolocation, Personal History, Matrix Tab).
- **Phase 4:** Admin Attendance Management (5 Tab Dashboard theo AVORA Design System, Modern UI/UX).
- **Phase 5:** Excel Engine (Workbook tương thích 100%, Sheet Nhật ký, Sheet Bảng công theo vai trò, Sheet Phiếu lương cá nhân có công thức động).
- **Phase 6:** Data Migration & Import Staging (Import lịch ca tuần, Import bảng công lịch sử Sushi Wa).
- **Phase 7:** Testing & Verification (Kiểm thử đơn vị, kiểm thử nghiệp vụ, đối chiếu dữ liệu Excel, regression test POS).

