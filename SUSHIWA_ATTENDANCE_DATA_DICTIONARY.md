# SUSHI WA ATTENDANCE — DATA DICTIONARY & SCHEMA MAPPING
## Comprehensive Model Field Mapping between Legacy Sushi Wa and AVORA

---

## 1. MAPPING TỔNG THỂ CÁC BẢNG (ENTITIES)

| Legacy (Sushi Wa JPA) | Target (AVORA Prisma Model) | Mục đích nghiệp vụ |
|---|---|---|
| `shifts` | `Shift` | Lịch ca làm việc theo ngày, vai trò, chi nhánh, ca gãy |
| `shift_assigned_users` | `_ShiftToUser` (Implicit ManyToMany) | Danh sách nhân viên được chỉ định riêng cho ca |
| `attendances` | `Attendance` | Bản ghi chấm công làm việc thực tế |
| `attendance_logs` | `AttendanceLog` | Nhật ký truy vết quét QR, GPS, Device và thao tác Admin |
| `branches` (Trường bổ sung) | `Branch` (Mở rộng trường) | Tọa độ GPS, bán kính cho phép, mã bí mật QR |
| `users` (Trường bổ sung) | `User` (Mở rộng trường) | `registeredDeviceId` quản lý thiết bị chấm công |

---

## 2. CHI TIẾT BẢNG SHIFT (LỊCH CA)

| Trường Legacy | Kiểu Legacy | Trường AVORA | Kiểu Prisma | Thuộc tính / Mô tả |
|---|---|---|---|---|
| `id` | `Long` (PK Auto) | `id` | `String @id @default(uuid())` | Khóa chính (UUID v4) |
| `shift_date` | `LocalDate` | `shiftDate` | `DateTime @db.Date` | Ngày làm việc cụ thể của ca |
| `role_id` | `ManyToOne Role` | `roleId` | `String?` | Khóa ngoại tới `AccessRole` |
| `name` | `String` | `name` | `String` | Tên ca (VD: Ca Sáng, Ca Chiều, Ca Gãy) |
| `startTime` | `LocalTime` | `startTime` | `String` | Giờ bắt đầu (định dạng `HH:mm`) |
| `endTime` | `LocalTime` | `endTime` | `String` | Giờ kết thúc (định dạng `HH:mm`) |
| `grace_period_mins` | `int (default 5)` | `gracePeriodMins`| `Int @default(5)` | Số phút cho phép đi trễ |
| `branch_id` | `ManyToOne Branch`| `branchId` | `String?` | Khóa ngoại tới `Branch` |
| `is_split_shift` | `Boolean (default false)` | `isSplitShift` | `Boolean @default(false)`| Cờ đánh dấu ca gãy |
| `start_time_2` | `LocalTime` | `startTime2` | `String?` | Giờ bắt đầu khung ca 2 (ca gãy) |
| `end_time_2` | `LocalTime` | `endTime2` | `String?` | Giờ kết thúc khung ca 2 (ca gãy) |
| `assignedUsers` | `ManyToMany User` | `assignedUsers` | `User[]` | Quan hệ nhiều-nhiều tới User |
| - | - | `createdAt` | `DateTime @default(now())`| Thời gian tạo |
| - | - | `updatedAt` | `DateTime @updatedAt` | Thời gian cập nhật |

---

## 3. CHI TIẾT BẢNG ATTENDANCE (BẢNG CÔNG)

| Trường Legacy | Kiểu Legacy | Trường AVORA | Kiểu Prisma | Thuộc tính / Mô tả |
|---|---|---|---|---|
| `id` | `Long` (PK Auto) | `id` | `String @id @default(uuid())` | Khóa chính (UUID v4) |
| `user_id` | `ManyToOne User` | `userId` | `String` | Khóa ngoại tới `User` |
| `branch_id` | `ManyToOne Branch`| `branchId` | `String` | Khóa ngoại tới `Branch` |
| `shift_id` | `ManyToOne Shift` | `shiftId` | `String?` | Khóa ngoại tới `Shift` (nullable) |
| `work_date` | `LocalDate` | `workDate` | `DateTime @db.Date` | Ngày công |
| `check_in_time` | `LocalDateTime` | `checkInTime` | `DateTime?` | Thời điểm Check-in thực tế |
| `check_out_time` | `LocalDateTime` | `checkOutTime` | `DateTime?` | Thời điểm Check-out thực tế |
| `status` | `String` | `status` | `String` | Trạng thái công (Xem mục 5) |
| `total_work_hours` | `Double` | `totalWorkHours`| `Float?` | Tổng giờ làm việc đã làm tròn 2 số thập phân |
| `notes` | `String (500)` | `notes` | `String? @db.VarChar(500)` | Ghi chú đi trễ/về sớm/admin sửa |
| - | - | `sourceSystem` | `String? @default("AVORA")` | Nguồn dữ liệu (`AVORA` hoặc `SUSHI_WA`) |
| - | - | `legacyId` | `String?` | ID gốc từ Sushi Wa phục vụ migration |
| - | - | `createdAt` | `DateTime @default(now())`| Thời gian tạo |
| - | - | `updatedAt` | `DateTime @updatedAt` | Thời gian cập nhật |

---

## 4. CHI TIẾT BẢNG ATTENDANCE_LOG (NHẬT KÝ CHẤM CÔNG & AUDIT)

| Trường Legacy | Kiểu Legacy | Trường AVORA | Kiểu Prisma | Thuộc tính / Mô tả |
|---|---|---|---|---|
| `id` | `Long` (PK Auto) | `id` | `String @id @default(uuid())` | Khóa chính (UUID v4) |
| `user_id` | `ManyToOne User` | `userId` | `String?` | Khóa ngoại tới `User` |
| `branch_id` | `ManyToOne Branch`| `branchId` | `String?` | Khóa ngoại tới `Branch` |
| `scan_time` | `LocalDateTime` | `scanTime` | `DateTime @default(now())` | Thời điểm quét/thao tác |
| `scan_type` | `String` | `scanType` | `String` | Loại: `CHECK_IN`, `CHECK_OUT`, `MANUAL_ADD`, `UPDATE_RECORD`, `DELETE_RECORD` |
| `client_latitude` | `double` | `clientLatitude` | `Float @default(0)` | Vĩ độ thiết bị gửi lên |
| `client_longitude` | `double` | `clientLongitude` | `Float @default(0)` | Kinh độ thiết bị gửi lên |
| `distance_calculated` | `double` | `distanceCalculated` | `Float @default(0)` | Khoảng cách tính toán (mét) |
| `client_accuracy` | `double` | `clientAccuracy` | `Float @default(0)` | Sai số GPS gửi lên (mét) |
| `is_success` | `boolean` | `isSuccess` | `Boolean @default(false)` | Trạng thái thành công hay thất bại |
| `error_code` | `String` | `errorCode` | `String?` | Mã lỗi hoặc SUCCESS |
| `device_id` | `String` | `deviceId` | `String?` | Mã phần cứng thiết bị hoặc `ADMIN_DASHBOARD` |
| `raw_qr_data` | `String` | `rawQrData` | `String? @db.Text` | Chuỗi QR quét được hoặc lý do thao tác admin |
| `shift_name` | `String` | `shiftName` | `String?` | Tên ca và ngày làm việc liên quan |
| - | - | `createdAt` | `DateTime @default(now())` | Thời gian tạo |

---

## 5. BẢNG TRẠNG THÁI ATTENDANCE STATUS

| Mã trạng thái | Diễn giải | Ý nghĩa hiển thị |
|---|---|---|
| `ON_TIME` | Vào ca đúng giờ | Nhân viên đến trong giờ hoặc trong khoảng grace period |
| `LATE` | Đi trễ | Đi trễ vượt quá thời gian ân hạn |
| `EARLY_LEAVE` | Về sớm | Ra ca trước giờ kết thúc ca làm |
| `LATE_AND_EARLY_LEAVE`| Trễ & Về sớm | Vừa đi trễ lúc vào vừa về sớm lúc ra |
| `FLEXIBLE` | Ca tự do | Dành cho bộ phận Bếp / Kitchen hoặc ca không định khung |
| `MISSING_CHECKOUT` | Thiếu Checkout | Đã Check-in nhưng hết ngày chưa Check-out |

---

## 6. MỞ RỘNG CÁC MODEL HIỆN HỮU CỦA AVORA

### 6.1. Model `User`:
- Thêm trường:
  ```prisma
  registeredDeviceId String? @map("registered_device_id") @db.VarChar(255)
  ```
  Lưu mã thiết bị di động đã gắn kết với nhân viên.

### 6.2. Model `Branch`:
- Đã có sẵn:
  - `latitude Float?`
  - `longitude Float?`
  - `allowedRadiusMeters Int @default(50)`
  - `qrSecretKey String?`
- Bổ sung quan hệ trong schema tới `Shift`, `Attendance`, `AttendanceLog`.

