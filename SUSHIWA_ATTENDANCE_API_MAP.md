# SUSHI WA ATTENDANCE — API ENDPOINT MAPPING SPECIFICATION
## Legacy Spring Boot Endpoints to AVORA NestJS REST API

---

## 1. BẢNG ÁNH XẠ TOÀN BỘ API

| STT | Phương thức | Endpoint Sushi Wa | Endpoint AVORA NestJS | Quyền hạn RBAC | Mô tả chức năng |
|---|---|---|---|---|---|
| 1 | `GET` | `/employee/attendance` | `/api/attendance/employee/me` | Logged-in Staff | Lấy dữ liệu trang chấm công của nhân viên |
| 2 | `GET` | `/api/employee/attendance-status` | `/api/attendance/employee/status` | Logged-in Staff | Kiểm tra trạng thái hiện tại (Đang làm hay Ra ca) |
| 3 | `POST`| `/api/employee/scan-qr` | `/api/attendance/employee/scan` | Logged-in Staff | Gửi dữ liệu quét QR, GPS, Device để Check-in/Check-out |
| 4 | `GET` | `/api/employee/attendance-history`| `/api/attendance/employee/history` | Logged-in Staff | Lấy lịch sử chấm công cá nhân theo khoảng thời gian |
| 5 | `GET` | `/attendance/qr-display` | `/api/attendance/qr/display-info` | `ATTENDANCE_QR_MANAGE` | Thông tin phục vụ màn hình QR quầy |
| 6 | `GET` | `/api/attendance/generate-qr` | `/api/attendance/qr/dynamic` | `ATTENDANCE_QR_MANAGE` | Tạo chuỗi QR động theo chi nhánh (kèm chữ ký MD5) |
| 7 | `GET` | `/api/attendance/branch-today` | `/api/attendance/qr/branch-today` | `ATTENDANCE_QR_MANAGE` | Lấy danh sách nhân viên vừa chấm công hôm nay tại chi nhánh |
| 8 | `GET` | `/api/attendance/generate-static-qr`| `/api/attendance/qr/static` | `ATTENDANCE_QR_MANAGE` | Tạo chuỗi QR tĩnh in giấy (kèm chữ ký MD5) |
| 9 | `GET` | `/admin/attendance` | `/api/attendance/admin/dashboard` | `ATTENDANCE_VIEW_LIST` | Lấy dữ liệu tổng quan cho 5 Tab Dashboard Admin |
| 10| `POST`| `/admin/attendance/shifts/save` | `/api/attendance/admin/shifts` | `ATTENDANCE_EDIT` | Thêm mới / cập nhật ca làm việc |
| 11| `POST`| `/admin/attendance/shifts/delete/{id}`| `/api/attendance/admin/shifts/:id` (DELETE) | `ATTENDANCE_EDIT` | Xóa 1 ca làm việc |
| 12| `POST`| `/admin/attendance/shifts/bulk-delete` | `/api/attendance/admin/shifts/bulk-delete` | `ATTENDANCE_EDIT` | Xóa nhiều ca làm việc |
| 13| `POST`| `/admin/attendance/shifts/import` | `/api/attendance/admin/shifts/import` | `ATTENDANCE_IMPORT` | Import lịch ca tuần từ file Excel |
| 14| `GET` | `/admin/attendance/export` | `/api/attendance/admin/export` | `ATTENDANCE_EXPORT` | Xuất file Excel bảng công tương thích 100% Sushi Wa |
| 15| `POST`| `/admin/attendance/manual-action` | `/api/attendance/admin/manual-action` | `ATTENDANCE_EDIT` | Cập nhật giờ vào/ra hoặc Xóa công kèm lý do |
| 16| `POST`| `/admin/attendance/manual-add` | `/api/attendance/admin/manual-add` | `ATTENDANCE_EDIT` | Thêm công thủ công (hỗ trợ ca gãy 2 khung) |
| 17| `GET` | `/admin/api/users-by-role` | `/api/attendance/admin/users-by-role` | `ATTENDANCE_VIEW_LIST` | Danh sách nhân viên theo vai trò phục vụ gán ca |
| 18| `GET` | `/admin/api/shifts-by-date` | `/api/attendance/admin/shifts-by-date` | `ATTENDANCE_VIEW_LIST` | Danh sách ca trong ngày để nhúng vào modal sửa |
| 19| `POST`| `/admin/attendance/reset-device` | `/api/attendance/admin/reset-device` | `ATTENDANCE_DEVICE_MANAGE` | Xóa liên kết thiết bị để nhân viên đổi máy |
| 20| `POST`| N/A (Mới) | `/api/attendance/admin/import-historical` | `ATTENDANCE_IMPORT` | Import dữ liệu chấm công lịch sử từ Sushi Wa |

---

## 2. CHI TIẾT REQUEST / RESPONSE CHỦ CHỐT

### 2.1. Quét mã QR (`POST /api/attendance/employee/scan`)
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Request Body (DTO):**
  ```json
  {
    "qrCodeData": "1|1731339800|a8f9c1b2d3",
    "latitude": 10.776889,
    "longitude": 106.700806,
    "accuracy": 15.2,
    "scanType": "AUTO",
    "deviceId": "HW_b6f7a8c9e0",
    "branchId": "uuid-branch-1"
  }
  ```
- **Response Success (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "status": "SUCCESS",
      "action": "CHECK_IN",
      "message": "Chấm công thành công!",
      "time": "08:02:15",
      "workDate": "2026-11-11",
      "shiftName": "Ca Sáng",
      "isRegisteredDevice": false
    }
  }
  ```
- **Response Lần đầu đăng ký máy (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "status": "SUCCESS_REGISTERED",
      "action": "CHECK_IN",
      "message": "Chấm công thành công! THIẾT BỊ NÀY ĐÃ ĐƯỢC ĐĂNG KÝ. Từ nay bạn chỉ được phép dùng điện thoại này để chấm công.",
      "time": "08:02:15"
    }
  }
  ```
- **Response Lỗi (400 Bad Request):**
  ```json
  {
    "success": false,
    "statusCode": 400,
    "error": {
      "code": "GEOFENCE_EXCEEDED",
      "message": "Bạn đang ở cách quán 150.5m (Vượt quá 50m). Không thể chấm công!"
    }
  }
  ```

---

### 2.2. Sinh QR Động (`GET /api/attendance/qr/dynamic?branchId=uuid-branch`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "qrData": "uuid-branch|1731340200|d41d8cd98f",
      "expiresInSeconds": 300,
      "branchName": "AVORA Riverside"
    }
  }
  ```

---

### 2.3. Sinh QR Tĩnh (`GET /api/attendance/qr/static?branchId=uuid-branch`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "qrData": "STATIC_QR|uuid-branch|9b87161b9a",
      "branchName": "AVORA Riverside",
      "branchAddress": "123 Bến Vân Đồn, Quận 4, TP.HCM"
    }
  }
  ```

