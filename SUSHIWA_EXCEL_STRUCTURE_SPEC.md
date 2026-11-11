# SUSHI WA ATTENDANCE — EXCEL WORKBOOK STRUCTURE SPECIFICATION
## Full Technical Specification for 100% Reverse-Engineered Excel Export Compatibility

---

## 1. NGUYÊN TẮC TƯƠNG THÍCH WORKBOOK

Tên file xuất chuẩn:
`BangChamCong_SushiWa_DDMMYYYY.xlsx`  
*(Trong AVORA cho phép cấu hình tiền tố thương hiệu, mặc định bảo toàn cấu trúc dữ liệu).*

Thư viện sinh file: `exceljs` trong NestJS.  
Toàn bộ định dạng bảng, chiều rộng cột, độ cao dòng, màu nền, đường viền, gộp ô (merged cells), cố định khung (freeze pane) và **công thức Excel động liên kết giữa các sheet** phải khớp 100% với hàm `exportToExcel()` của Sushi Wa.

---

## 2. BẢNG MÀU SẮC & CELL STYLES

| Kiểu Style | Font chữ | Cỡ / Kiểu | Màu nền (Fill Foreground) | Căn lề | Định dạng dữ liệu |
|---|---|---|---|---|---|
| `titleStyle` | Calibri | 16pt Bold | Trong suốt | Trái (Left) | Text |
| `centerTitleStyle` | Calibri | 16pt Bold | Trong suốt | Giữa (Center) | Text |
| `subtitleStyle` | Calibri | 11pt Bold | Trong suốt | Trái (Left) | Text |
| `headerStyle` | Calibri | 11pt Bold | Xám 25% (`#D9D9D9` / `GREY_25_PERCENT`) | Giữa (Center, Wrap Text) | Viền mỏng 4 cạnh |
| `weekendHeaderStyle` | Calibri | 11pt Bold | Cam nhạt (`#F8CBAD` / `LIGHT_ORANGE`) | Giữa (Center, Wrap Text) | Viền mỏng 4 cạnh |
| `subHeaderStyle` | Calibri | 11pt Bold | Xanh nhạt (`#BDD7EE` / `PALE_BLUE`) | Giữa (Center, Wrap Text) | Viền mỏng 4 cạnh |
| `dataStyleLeft` | Calibri | 11pt Regular | Trong suốt | Trái (Left, Wrap Text) | Viền mỏng 4 cạnh |
| `dataStyleCenter` | Calibri | 11pt Regular | Trong suốt | Giữa (Center, Wrap Text) | Viền mỏng 4 cạnh |
| `weekendDataStyle` | Calibri | 11pt Regular | Cam nhạt (`#F8CBAD` / `LIGHT_ORANGE`) | Giữa (Center, Wrap Text) | Viền mỏng 4 cạnh |
| `totalStyle` | Calibri | 11pt Bold | Vàng kem (`#FFF2CC` / `LEMON_CHIFFON`) | Giữa (Center) | Viền mỏng 4 cạnh |
| `currencyStyle` | Calibri | 11pt Regular | Trong suốt | Phải (Right) | `[$-vi-VN]#,##0` |
| `yellowCurrency` | Calibri | 11pt Bold | Vàng kem (`#FFF2CC` / `LEMON_CHIFFON`) | Phải (Right) | `[$-vi-VN]#,##0` |
| `totalLabelStyle` | Calibri | 11pt Bold | Vàng kem (`#FFF2CC` / `LEMON_CHIFFON`) | Trái (Left) | Viền mỏng 4 cạnh |

---

## 3. SHEET 1: NHẬT KÝ CHI TIẾT (`Nhật Ký Chi Tiết`)

- **Freeze Pane:** Cố định 2 cột đầu (STT, Tên NV) và 9 dòng đầu: `createFreezePane(2, 9)`.
- **Thông tin tiêu đề:**
  - Row 0: `CÔNG TY TNHH SUSHI WA` (Col 0, `subtitleStyle`)
  - Row 1: `Ngày xuất báo cáo: HH:mm dd/MM/yyyy` (Col 0, `subtitleStyle`)
  - Row 3: `BẢNG NHẬT KÝ CHẤM CÔNG CHI TIẾT` (Col 0, `titleStyle`)
  - Row 4: `Từ ngày dd/MM/yyyy đến ngày dd/MM/yyyy` (Col 0, `subtitleStyle`)
- **Cột cố định (Rows 6 - 8, gộp dòng 6-8 cho từng cột 0 đến 9):**
  1. Col 0: `STT` (Chiều rộng: `5`)
  2. Col 1: `Tên Nhân viên` (Chiều rộng: `22`)
  3. Col 2: `Tổng số ca` (Chiều rộng: `12`)
  4. Col 3: `Tổng giờ` (Chiều rộng: `12`)
  5. Col 4: `Đúng giờ (Lần)` (Chiều rộng: `12`)
  6. Col 5: `Số lần đi trễ` (Chiều rộng: `12`)
  7. Col 6: `Số phút đi trễ` (Chiều rộng: `12`)
  8. Col 7: `Số giờ đi trễ` (Chiều rộng: `12`)
  9. Col 8: `Số phút về muộn` (Chiều rộng: `12`)
  10. Col 9: `Số giờ về muộn` (Chiều rộng: `12`)
- **Cột theo từng ngày (Từ Col 10, bước nhảy 4 cột mỗi ngày):**
  - Row 6: `dd/MM` (Gộp 4 cột `col` đến `col + 3`, header style thường hoặc weekend)
  - Row 7: Thứ trong tuần (`Thứ 2`..`Thứ 7`, `CN`) (Gộp 4 cột `col` đến `col + 3`)
  - Row 8: 4 cột con (`subHeaderStyle`, màu PALE_BLUE):
    - `Thuộc ca` (Chiều rộng: `15`)
    - `Giờ vào` (Chiều rộng: `8`)
    - `Giờ ra` (Chiều rộng: `8`)
    - `Ghi chú` (Chiều rộng: `18`)
- **Dữ liệu nhân viên (Bắt đầu từ Row 9):**
  - Nếu nhân viên làm nhiều ca trong cùng 1 ngày (`maxShiftsInDay > 1`):
    - Sinh ra `maxShiftsInDay` dòng liên tiếp.
    - Gộp các ô thuộc cột 0 đến 9 trên toàn bộ các dòng này của nhân viên.
  - Cột 1 ghi: `{Tên nhân viên}\n({Tên vai trò})`.

---

## 4. SHEET 2: BẢNG CÔNG THEO VAI TRÒ (`Bảng công - [RoleName]`)

- **Tên sheet:** `Bảng công - {Tên vai trò}` (Được làm sạch ký tự cấm, tối đa 31 ký tự).
- **Lưới hiển thị:** Tắt gridlines mặc định (`showGridLines = false`).
- **Freeze Pane:** Cố định 2 cột đầu và 6 dòng đầu: `createFreezePane(2, 6)`.
- **Tiêu đề:**
  - Row 0: `CÔNG TY TNHH SUSHI WA`
  - Row 2: `BẢNG TỔNG HỢP GIỜ CÔNG - {ROLENAME}` (In hoa)
- **Header (Rows 4 - 5):**
  - Col 0: `HỌ TÊN NHÂN VIÊN` (Gộp dòng 4-5, width 25)
  - Col 1: `PHÂN LOẠI` (Gộp dòng 4-5, width 16)
  - Col 2 trở đi (Mỗi ngày 1 cột, width 9):
    - Row 4: Ngày dạng `dd/MM`. Nếu là **Ngày lễ**: hiển thị `"x3\n" + dd/MM` (Độ cao dòng 35pt).
    - Row 5: Thứ trong tuần (`Thứ 2`..`Thứ 7`, `CN`). Thứ 7 và CN dùng `weekendHeaderStyle`.
  - Cột cuối cùng (`lastCol = numOfDays + 2`): `TỔNG GIỜ` (Gộp dòng 4-5, width 15).
- **Dữ liệu nhân viên (Bắt đầu từ Row 6):**
  - **Trường hợp tính tăng ca (`calculateOvertime = true`):**
    - Mỗi nhân viên chiếm **2 dòng**:
      - Dòng 1: Cột Phân loại ghi `"Giờ chuẩn (<=8h)"`.
      - Dòng 2: Cột Phân loại ghi `"Tăng ca (>8h)"`.
      - Cột 0 (Họ tên) gộp 2 dòng liên tiếp.
    - Cột Ngày lễ: Dồn toàn bộ `dailyHours * 3` vào dòng Giờ chuẩn; dòng Tăng ca ghi `"-"`.
    - Cột Ngày thường:
      - Giờ chuẩn: $\le 8$ ghi số giờ, $> 8$ ghi `8`.
      - Tăng ca: $> 8$ ghi phần chênh lệch `(dailyHours - 8)`, $\le 8$ ghi `"-"`.
    - Cột TỔNG GIỜ:
      - Dòng Giờ chuẩn: Công thức Excel `=SUM(C{rowNorm}:{endCol}{rowNorm})`, style `LEMON_CHIFFON`.
      - Dòng Tăng ca: Công thức Excel `=SUM(C{rowOt}:{endCol}{rowOt})`, style `LEMON_CHIFFON`.
      - Lưu lại toạ độ ô:
        - `userNormRefs[userId] = "'Bảng công - Role'!" + lastColLetter + rowNormNumber`
        - `userOtRefs[userId] = "'Bảng công - Role'!" + lastColLetter + rowOtNumber`
  - **Trường hợp không tính tăng ca:**
    - Mỗi nhân viên chiếm 1 dòng, cột Phân loại ghi `"Tổng giờ làm"`.
    - Cột TỔNG GIỜ: Công thức `=SUM(C{row}:{endCol}{row})`.

---

## 5. SHEET 3+: PHIẾU LƯƠNG CÁ NHÂN (`PL - [EmployeeName]`)

Mỗi nhân viên có 1 sheet riêng biệt mang tên `PL - {Tên nhân viên}`.
- **Cấu hình cột:**
  - Col 0: Width `5`
  - Col 1: Width `6` (Mã mục I, II, 1, 2)
  - Col 2: Width `35` (Tên khoản / Chi tiết)
  - Col 3: Width `20` (Số tiền / Công thức)
  - Col 4: Width `30` (Diễn giải)
- **Tiêu đề:**
  - Row 1: `PHIẾU THANH TOÁN LƯƠNG` (Gộp Col 1-4, `centerTitleStyle`)
  - Row 2: `Tháng MM/yyyy` (Gộp Col 1-4, `centerTitleStyle`)
  - Row 4:
    - Col 1-2 gộp: `Mã nhân viên: {username}`
    - Col 3-4 gộp: `Họ và tên: {name}`
  - Row 5:
    - Col 1-2 gộp: Công thức liên kết động:
      `="Tổng giờ công: " & ROUND('Bảng công - Role'!ColRow, 2)`
    - Col 3-4 gộp: `Chức vụ: {roleName}`
  - Row 6 (Nếu có tính tăng ca):
    - Col 1-2 gộp: Công thức liên kết động:
      `="Giờ tăng ca: " & ROUND('Bảng công - Role'!ColRow, 2)`
- **Bảng chi tiết thanh toán (Bắt đầu từ Row 8):**
  - **Row 8 (Header):** `Stt`, `Chi tiết`, `Số tiền`, `Diễn giải` (`headerStyle`)
  - **Row 9 (Mục I):** `I` | `Mức lương/ giờ lương` | `0` (Ô D10 để HR tự nhập mức lương theo giờ) | `-`
  - **Row 10 (Mục II):** `II` | `Khoản cộng (1)` | `=SUM(D12:D17)` (`yellowCurrency`) | `-`
  - **Rows 11 - 16 (Các khoản cộng):**
    1. `Lương chính` | Công thức động: `=D10 * 'Bảng công - Role'!ColRowNorm` | `-`
    2. `Lương tăng ca` | Công thức động: `=D10 * 'Bảng công - Role'!ColRowOt` | `-`
    3. `Trách nhiệm` | `0` | `-`
    4. `Hỗ trợ đi lại` | `0` | `-`
    5. `Thưởng nóng` | `0` | `-`
    6. `Khác` | `0` | `-`
  - **Row 17 (Mục III):** `III` | `Khoản trừ (2)` | `=SUM(D19:D20)` (`yellowCurrency`) | `-`
  - **Rows 18 - 19 (Các khoản trừ):**
    1. `Món ăn bị lỗi/ Lỗi vệ sinh` | `0` | `-`
    2. `Khác` | `0` | `-`
  - **Row 20 (Mục IV):** `IV` | `Tạm ứng (3)` | `0` (`yellowCurrency`) | `-`
  - **Row 21 (Tổng cộng):** `-` | `Tổng cộng (1)-(2)-(3)` | `=D11 - D18 - D21` (`yellowCurrency`) | `-`
  - **Row 24 (Chữ ký):**
    - Col 2: `Người lập phiếu` (Center)
    - Col 4: `Nhân viên ký nhận` (Center)

---

## 6. KÍCH HOẠT TÍNH TOÁN CÔNG THỨC TRÊN EXCEL
Bắt buộc bật cờ tính lại công thức khi file Excel được mở trên máy người dùng:
```typescript
workbook.calcProperties.fullCalcOnLoad = true;
```
Đảm bảo khi mở bằng Microsoft Excel hoặc Google Sheets, toàn bộ số liệu công và lương tự động nhảy theo giá trị ô tham chiếu.

