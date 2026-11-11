# SUSHI WA ATTENDANCE — BUSINESS RULES & CALCULATION LOGIC
## Complete Specification of Business Formulas, Overlap Rules, and Geofencing

---

## 1. QUY TẮC QUẢN LÝ THIẾT BỊ (DEVICE BINDING)

1. Khi nhân viên quét mã chấm công lần đầu tiên:
   - Nếu `user.registeredDeviceId` đang `null` hoặc rỗng:
     - Lưu `incomingDeviceId` vào `user.registeredDeviceId`.
     - Phản hồi mã thành công: `SUCCESS_REGISTERED`.
     - Thông báo trên màn hình: *"Chấm công thành công! THIẾT BỊ NÀY ĐÃ ĐƯỢC ĐĂNG KÝ. Từ nay bạn chỉ được phép dùng điện thoại này để chấm công."*
2. Khi nhân viên quét các lần tiếp theo:
   - Nếu `user.registeredDeviceId` khác `incomingDeviceId` và chế độ bảo vệ thiết bị được bật:
     - Ném lỗi: *"LỖI BẢO MẬT: Tài khoản của bạn đã được đăng ký trên điện thoại khác! Vui lòng dùng đúng máy của mình hoặc nhờ Admin Reset lại thiết bị."*
3. Admin Reset thiết bị:
   - Admin có quyền nhấn nút "Reset thiết bị" trong tab Quản lý thiết bị.
   - Thao tác đặt lại `user.registeredDeviceId = null`.
   - Ghi nhận hành động vào nhật ký audit.

---

## 2. QUY TẮC XÁC ĐỊNH HÀNH ĐỘNG CHECK-IN / CHECK-OUT (AUTO DETECTION)

Khi nhận request có `scanType: "AUTO"`:
1. Tìm bản ghi chấm công mới nhất trong ngày (`workDate = today`) của nhân viên:
   ```sql
   SELECT * FROM attendances 
   WHERE user_id = :userId AND work_date = :today 
   ORDER BY check_in_time DESC LIMIT 1
   ```
2. Nếu bản ghi mới nhất có `checkInTime != null` và `checkOutTime == null`:
   - Nhân viên đang trong ca làm việc.
   - Thao tác tiếp theo là: `CHECK_OUT`.
3. Nếu chưa có bản ghi hoặc bản ghi mới nhất đã có đủ cả `checkInTime` và `checkOutTime`:
   - Nhân viên không ở trong ca làm.
   - Thao tác tiếp theo là: `CHECK_IN`.

### Kiểm tra tính toàn vẹn trạng thái (validateCheckInOutState):
- Nếu yêu cầu là `CHECK_IN` mà nhân viên đang trong ca (chưa Check-out ca trước):
  - Báo lỗi: *"Bạn đang TRONG CA làm. Vui lòng Check-out ca hiện tại trước khi bắt đầu ca mới!"*
- Nếu yêu cầu là `CHECK_OUT` mà nhân viên chưa Check-in trong ngày hoặc đã kết thúc ca:
  - Báo lỗi: *"Bạn chưa Check-in hoặc đã kết thúc ca trước đó rồi. Không thể Check-out!"*

---

## 3. QUY TẮC BẢO MẬT QR VÀ THỜI GIAN HẾT HẠN

Chuỗi mã QR được chia thành 3 phần ngăn cách bởi dấu `|`:

### 3.1. QR Tĩnh (`STATIC_QR|<branchId>|<signature>`)
- Dùng cho biển in treo cố định tại chi nhánh.
- Chuỗi băm MD5:
  ```
  rawData = "STATIC_QR|" + branchId + "|" + qrSecretKey
  expectedSignature = MD5(rawData).substring(0, 10)
  ```
- Nếu `signature != expectedSignature` -> Lỗi: *"Mã QR tĩnh không hợp lệ hoặc đã bị làm giả!"*.
- QR Tĩnh không có thời hạn hết hạn; thời gian chấm công căn cứ vào đồng hồ máy chủ tại thời điểm nhận request.

### 3.2. QR Động (`<branchId>|<timestamp>|<signature>`)
- Dùng trên màn hình máy tính / tablet quầy thu ngân.
- Chuỗi băm MD5:
  ```
  rawData = branchId + "|" + timestamp + "|" + qrSecretKey
  expectedSignature = MD5(rawData).substring(0, 10)
  ```
- Nếu `signature != expectedSignature` -> Lỗi: *"Mã QR động không hợp lệ hoặc đã bị can thiệp!"*.
- **Kiểm tra thời hạn:**
  ```
  currentTimestamp = currentTimeMillis / 1000
  timeDiff = currentTimestamp - qrTimestamp
  ```
  Nếu `timeDiff > 300` hoặc `timeDiff < -5`:
  - Báo lỗi: *"Mã QR đã hết hạn! Vui lòng quét mã mới nhất trên màn hình tại quán."*

---

## 4. QUY TẮC ĐỊNH VỊ GPS VÀ GEOFENCE

1. Khoảng cách địa lý tính bằng công thức Haversine:
   $$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta\text{lon}}{2}\right)$$
   $$c = 2 \cdot \text{atan2}(\sqrt{a}, \sqrt{1-a})$$
   $$\text{distance} = 6371000 \cdot c \text{ (mét)}$$
2. Bán kính cho phép:
   $$\text{allowedRadius} = \min(\text{branch.allowedRadiusMeters} > 0 ? \text{branch.allowedRadiusMeters} : 500, 400.0)$$
   *(Mặc định 50-400 mét).*
3. Kiểm tra độ chính xác GPS của thiết bị (`accuracy`):
   - Nếu `accuracy > 300m`: Báo lỗi *"Tín hiệu GPS quá yếu. Hãy ra ngoài trời hoặc bật cho phép vị trí chính xác."*
4. Kiểm tra khoảng cách:
   - Nếu $\text{distance} > \text{allowedRadius}$:
     - Nếu $\text{distance} \le \text{allowedRadius} + \text{accuracy}$:
       - Cho phép chấm công nhưng đánh dấu mã cảnh báo vào log: `WARNING_HIGH_ACCURACY_ERROR`.
     - Nếu $\text{distance} > \text{allowedRadius} + \text{accuracy}$:
       - Từ chối chấm công: *"Bạn đang ở cách quán Xm (Vượt quá Ym). Không thể chấm công!"*

---

## 5. QUY TẮC PHÂN CA (SHIFT MATCHING)

1. **Bộ phận Bếp (Kitchen / Flexible):**
   - Nếu tên vai trò chứa `"KITCHEN"` hoặc `"BẾP"`:
     - Không ép vào ca cố định (`shift = null`).
     - `status = "FLEXIBLE"`.
     - `notes = "Làm ca tự do"`.
2. **Bộ phận Phục vụ và các vai trò khác:**
   - Tìm tất cả các ca trong ngày (`shiftDate = today`) phù hợp với vai trò của nhân viên.
   - **Mức ưu tiên 1:** Các ca có chỉ định cụ thể nhân viên này trong `assignedUsers`.
   - **Mức ưu tiên 2:** Các ca chung cho cả vai trò (`assignedUsers` rỗng).
   - **Thuật toán tìm ca gần nhất (`findClosestShift`):**
     - Khoảng cách thời gian giữa giờ Check-in và giờ bắt đầu ca:
       - Với ca thường: `diff = |checkInTime - startTime|`.
       - Với ca gãy: `diff = min(|checkInTime - startTime|, |checkInTime - startTime2|)`.
     - Điều kiện hợp lệ: `diff <= 120 phút` (2 tiếng).
     - Ca nào có `diff` nhỏ nhất sẽ được chọn.
     - Nếu không tìm thấy ca nào trong khoảng 120 phút: Gán `shift = null`, `status = "FLEXIBLE"`.

---

## 6. QUY TẮC TÍNH ĐI TRỄ & VỀ SỚM

### 6.1. Đi trễ (Late)
1. Xác định giờ bắt đầu ca mục tiêu:
   - Với ca thường: `shiftStart = shift.startTime`.
   - Với ca gãy: Chọn `startTime` hoặc `startTime2` có khoảng cách phút gần nhất tới `checkInTime`.
2. Tính số phút đi trễ có bù trừ sai số 3 phút:
   $$\text{lateMinutes} = (\text{checkInTime} - \text{shiftStart}) - 3$$
3. Đánh giá:
   - Nếu $\text{lateMinutes} > \text{shift.gracePeriodMins}$:
     - `status = "LATE"`
     - `notes = [Prefix Ca gãy] + "Đi trễ " + lateMinutes + " phút"`
   - Ngược lại:
     - `status = "ON_TIME"`
     - `notes = [Prefix Ca gãy] + "Vào ca đúng giờ"`

### 6.2. Về sớm (Early Leave)
1. Xác định giờ kết thúc ca dự kiến:
   - Với ca thường: `expectedEnd = shift.endTime`.
   - Với ca gãy: Chọn `endTime` hoặc `endTime2` gần với `checkOutTime` nhất.
2. Tính số phút về sớm có bù trừ sai số 3 phút:
   $$\text{earlyMinutes} = (\text{expectedEnd} - \text{checkOutTime}) - 3$$
3. Đánh giá:
   - Nếu $\text{earlyMinutes} > 0$:
     - `notes += " | Về sớm " + earlyMinutes + " phút"`
     - Nếu trạng thái trước đó là `LATE`: cập nhật thành `LATE_AND_EARLY_LEAVE`.
     - Nếu không: cập nhật thành `EARLY_LEAVE`.

---

## 7. CÔNG THỨC TÍNH GIỜ CÔNG HIỆU QUẢ (SHIFT OVERLAP CALCULATION)

Đối với nhân viên có ca làm việc, thời gian công được tính bằng thời gian làm việc thực tế nằm trong khung giờ của ca:

1. Mở rộng biên độ 3 phút cho nhân viên:
   $$\text{effectiveIn} = \text{actualIn} - 3\text{ phút}$$
   $$\text{effectiveOut} = \text{actualOut} + 3\text{ phút}$$
2. Khoan hồng theo `gracePeriod`:
   - Nếu $\text{sStart} < \text{effectiveIn} < \text{sStart} + \text{gracePeriod} + 1$:
     - Co $\text{effectiveIn} = \text{sStart}$ (xem như vào đúng giờ, tính tròn từ đầu ca).
   - Nếu $\text{sEnd} - \text{gracePeriod} - 1 < \text{effectiveOut} < \text{sEnd}$:
     - Co $\text{effectiveOut} = \text{sEnd}$ (xem như làm đủ đến hết ca).
3. Cắt phần thừa ngoài ca (Clamping):
   $$\text{overlapStart} = \max(\text{effectiveIn}, \text{sStart})$$
   $$\text{overlapEnd} = \min(\text{effectiveOut}, \text{sEnd})$$
4. Số phút công của khung:
   $$\text{minutes} = \max(0, \text{overlapEnd} - \text{overlapStart})$$
5. **Đối với ca gãy:**
   $$\text{totalMinutes} = \text{minutes}(\text{khung 1}) + \text{minutes}(\text{khung 2})$$
6. **Tổng giờ công:**
   $$\text{totalWorkHours} = \text{round}\left(\frac{\text{totalMinutes}}{60.0}, 2\right)$$

*Lưu ý: Đối với ca tự do (`shift == null`), giờ công được tính bằng khoảng cách tuyệt đối giữa `checkInTime` và `checkOutTime` chia cho 60.*

---

## 8. QUY TẮC NGÀY LỄ (X3 LƯƠNG) & TĂNG CA

1. **Lịch ngày lễ:**
   - Ngày Dương lịch: 01/01 (Tết Dương lịch), 30/04 (Giải phóng miền Nam), 01/05 (Quốc tế Lao động), 02/09 (Quốc khánh).
   - Ngày Âm lịch (Đã mapping theo năm): Mùng 1 đến mùng 4 Tết Âm Lịch, 10/03 ÂL (Giỗ tổ Hùng Vương).
2. **Quy tắc phân bổ giờ công ngày lễ:**
   - Nếu ngày làm việc là **Ngày lễ**:
     - Áp dụng hệ số nhân: `multiplier = 3.0`.
     - Toàn bộ giờ làm được dồn vào **Giờ chuẩn (<= 8h)**:
       $$\text{nHrs} = \text{dailyHours} \times 3.0$$
       $$\text{oHrs} = 0 \text{ (Không tính cột tăng ca)}$$
3. **Quy tắc ngày thường:**
   - Nếu tùy chọn `calculateOvertime == true`:
     - Giờ chuẩn: $\text{nHrs} = \min(\text{dailyHours}, 8.0)$
     - Giờ tăng ca: $\text{oHrs} = \max(0, \text{dailyHours} - 8.0)$
   - Nếu không tính tăng ca:
     - Giờ chuẩn: $\text{nHrs} = \text{dailyHours}$, $\text{oHrs} = 0$.

---

## 9. QUY TẮC ĐỒNG BỘ CA VÀ BẢNG CÔNG (`syncAttendancesWithShifts`)

Khi người quản trị thêm mới, cập nhật hoặc xóa ca làm việc của một ngày:
1. Lấy toàn bộ các bản ghi `Attendance` trong ngày đó (`workDate = date`).
2. Bỏ qua các nhân viên có vai trò Bếp (`isFlexibleRole = true`).
3. Với các nhân viên còn lại:
   - Tìm ca tốt nhất theo cấu hình ca mới nhất của ngày hôm đó (xét `assignedUsers` trước, sau đó xét ca chung của role).
   - Cập nhật lại `attendance.shift = bestMatchShift`.
   - Tính toán lại toàn bộ `lateMinutes`, `earlyMinutes`, `status`, `notes`, `totalWorkHours`.
   - Lưu lại vào cơ sở dữ liệu.
4. Bảo đảm tính nhất quán dữ liệu mà không cần chỉnh sửa thủ công từng dòng.

