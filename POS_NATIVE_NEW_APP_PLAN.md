# KẾ HOẠCH PHÁT TRIỂN ỨNG DỤNG MỚI: AVORA POS DESKTOP NATIVE

## 1. MỤC TIÊU DỰ ÁN
Xây dựng một ứng dụng hoàn toàn mới **AVORA POS Desktop Native** (`desktop/AvoraPosNative/`) sử dụng 100% C# .NET 8 WPF XAML MVVM, **TUYỆT ĐỐI KHÔNG DÙNG WEBVIEW / CHROMIUM / CEF / ELECTRON**.
- **Không đè lên app cũ**: `desktop/AvoraPos/` (Hybrid WebView2) tiếp tục tồn tại song song, không sửa đổi gây ảnh hưởng hay xung đột.
- **Giữ nguyên 100% giao diện Native Login hiện tại**: Kế thừa chuẩn visual luxury, bố cục 2 cột (55% thương hiệu + 45% form login), typography, hình ảnh, Google OAuth button, error banner, server connection status dot.
- **Bê toàn bộ nghiệp vụ từ Web POS (`/admin/pos`) sang WPF Native**: Table map, Order cart, Product menu, Product options, Table operations (move/merge/split), KDS realtime, QR orders, Reservations, Buffet sessions, Delivery/Takeaway, Customer/Membership, Vouchers, Payments, Cash shifts, Native Printing (ESC/POS & TSPL/ZPL qua WinSpool RAW / TCP 9100).

---

## 2. NGUYÊN TẮC CÔ LẬP TUYỆT ĐỐI GIỮA HAI ỨNG DỤNG

| Đặc tính | AVORA POS Desktop (Cũ / Hybrid) | AVORA POS Desktop Native (Mới / Pure WPF) |
| :--- | :--- | :--- |
| **Thư mục mã nguồn** | `desktop/AvoraPos/` | `desktop/AvoraPosNative/` |
| **Project & Assembly** | `AvoraPos.csproj` -> `AvoraPos.exe` | `AvoraPosNative.csproj` -> `AvoraPosNative.exe` |
| **Phiên bản ban đầu** | `1.0.1` | `1.0.0` |
| **Inno Setup Script** | `installer/avora-pos-setup.iss` | `installer/avora-pos-native-setup.iss` |
| **Inno Setup AppId** | `{{A1B2C3D4-E5F6-7890-ABCD-AVORAPOS2026}}` | `{{B2C3D4E5-F6A7-8901-BCDE-AVORAPOSNATIVE2026}}` |
| **Installer File** | `dist/installer/AVORA-POS-Setup.exe` | `dist/installer/AVORA-POS-Native-Setup.exe` |
| **Install Directory** | `%LOCALAPPDATA%\Programs\AVORA POS\` | `%LOCALAPPDATA%\Programs\AVORA POS Native\` |
| **App Data Root** | `%LOCALAPPDATA%\AVORA POS\` | `%LOCALAPPDATA%\AVORA POS Native\` |
| **SQLite Offline DB** | `...\AVORA POS\Data\avora_pos_offline.db` | `...\AVORA POS Native\Data\avora_pos_native.db` |
| **Single Instance Mutex**| `AVORA_POS_DESKTOP_SINGLE_INSTANCE_MUTEX` | `AVORA_POS_NATIVE_SINGLE_INSTANCE` |
| **Custom URI Scheme** | `avora-pos://` | `avora-pos-native://` |
| **Named Pipe Relay** | `AvoraPos_SingleInstancePipe` | `AvoraPosNative_SingleInstancePipe` |
| **Shortcuts** | `AVORA POS` | `AVORA POS Native` |
| **UI Engine** | WPF + WebView2 Edge Chromium | 100% WPF XAML + MVVM (Zero WebView) |

---

## 3. KIẾN TRÚC MÃ NGUỒN `desktop/AvoraPosNative/`

```
desktop/AvoraPosNative/
├── AvoraPosNative.csproj
├── App.xaml / App.xaml.cs                 # Mutex, avora-pos-native:// protocol, SingleInstancePipe
├── MainWindow.xaml / MainWindow.xaml.cs   # Kiosk Window, Hotkeys (Alt+F4, F11), Shell host
├── avora_logo_desktop.ico
├── Assets/
│   ├── avora_logo_desktop.png
│   └── restaurant_bg.png
├── Models/
│   ├── AuthModels.cs                      # Login request, UserProfile, AuthResponse
│   ├── PosBranch.cs                       # Chi nhánh, print settings, VAT mode
│   ├── PosCategory.cs                     # Nhóm món ăn
│   ├── PosProduct.cs                      # Món ăn, phân loại, option groups, buffet tags
│   ├── PosTable.cs                        # Bàn ăn, khu vực, trạng thái VACANT/OCCUPIED/BILL_PRINTED
│   ├── PosOrder.cs                        # Đơn hàng POS, items, options, discount, VAT, fees
│   ├── PosCustomer.cs                     # Khách hàng, hạng thành viên, tích điểm, hóa đơn VAT
│   ├── PosVoucher.cs                      # Voucher khuyến mãi
│   ├── PosReservation.cs                  # Lịch đặt bàn
│   ├── PosCashShift.cs                    # Ca làm việc thu ngân, kiểm quỹ
│   ├── PosQrOrder.cs                      # Đơn đặt món qua QR tại bàn
│   └── PrintModels.cs                     # Payload in bill, in bếp, in tem nhãn
├── Services/
│   ├── AuthService.cs                     # Gọi /api/auth/desktop/login, /api/auth/me, DPAPI
│   ├── PosApiService.cs                   # Toàn bộ API nghiệp vụ POS (/api/pos/...)
│   ├── RealtimeService.cs                 # Socket.IO Client kết nối /pos namespace
│   ├── PermissionService.cs               # Kiểm tra RBAC (ADMIN hoặc pos.access)
│   ├── PrintService.cs                    # Điều phối in ấn Bill, Bếp, Tem nhãn
│   ├── SyncService.cs                     # Đồng bộ dữ liệu định kỳ & sự kiện
│   ├── SsoService.cs                      # Xử lý avora-pos-native://open và Google OAuth
│   └── UpdateService.cs                   # Kiểm tra bản cập nhật AVORA POS Native
├── Printing/
│   ├── WinSpoolNative.cs                  # Giao tiếp P/Invoke winspool.drv RAW
│   ├── EscPosEngine.cs                    # Sinh lệnh in nhiệt hóa đơn & phiếu bếp
│   ├── RasterTextEngine.cs                # Render tiếng Việt có dấu chất lượng cao
│   ├── TsplEngine.cs                      # Sinh mã in tem nhãn TSPL (món, mã vạch)
│   ├── ZplEngine.cs                       # Sinh mã in nhãn ZPL
│   ├── TcpRawPrinter.cs                   # Gửi raw socket TCP port 9100 đến máy in LAN
│   └── PersistentPrintQueue.cs            # Hàng đợi in bền bỉ, tự động retry khi lỗi
├── Storage/
│   ├── AppDataPaths.cs                    # Quản lý đường dẫn dữ liệu tách biệt
│   ├── DeviceIdentifier.cs                # Mã nhận diện phần cứng máy trạm
│   ├── SecureSessionManager.cs            # Lưu token DPAPI trong %LOCALAPPDATA%\AVORA POS Native\Config
│   ├── LocalDatabase.cs                   # SQLite cục bộ cho offline cache & print queue
│   └── OfflineSyncEngine.cs               # Đồng bộ đơn hàng offline khi có mạng
├── ViewModels/
│   ├── ViewModelBase.cs                   # INotifyPropertyChanged, RelayCommand
│   ├── LoginViewModel.cs                  # Điều khiển Native Login, Google Login, Validation
│   ├── PosShellViewModel.cs               # Quản lý Tabs, Branch selector, State máy trạm
│   ├── TableMapViewModel.cs               # Sơ đồ bàn, lọc khu vực, trạng thái bàn realtime
│   ├── ProductMenuViewModel.cs            # Danh mục, danh sách món, tìm kiếm tiếng Việt
│   ├── OrderViewModel.cs                  # Giỏ hàng, tính giá, chiết khấu, gửi bếp, hủy
│   ├── PaymentViewModel.cs                # Thu tiền: Tiền mặt, QR Banking, Thẻ
│   ├── VoucherViewModel.cs                # Tra cứu và áp dụng voucher
│   ├── CustomerViewModel.cs               # Chọn khách, tích điểm, thông tin xuất VAT
│   ├── ReservationViewModel.cs            # Tiếp nhận đặt bàn, check-in vào bàn
│   ├── KitchenViewModel.cs                # Màn hình KDS/Bếp realtime
│   └── SettingsViewModel.cs               # Cài đặt máy in, chế độ hiển thị
├── Views/
│   ├── LoginView.xaml                     # 100% Native Login UI (y hệt app cũ)
│   ├── PosShellView.xaml                  # Shell chính chứa Header, Tab navigation, Main Workspace
│   ├── TableMapView.xaml                  # Giao diện trực quan sơ đồ bàn theo khu vực
│   ├── ProductMenuView.xaml               # Grid món ăn và thanh danh mục
│   ├── OrderView.xaml                     # Panel giỏ hàng và danh sách món đã gọi
│   ├── PaymentView.xaml                   # Giao diện thanh toán tiền mặt/QR/thẻ
│   ├── CustomerView.xaml                  # Giao diện tìm kiếm/chọn hội viên
│   ├── VoucherView.xaml                   # Giao diện danh sách mã giảm giá
│   ├── ReservationView.xaml               # Giao diện danh sách đặt bàn
│   ├── KitchenView.xaml                   # Màn hình quản lý món bếp/bar
│   ├── CashShiftView.xaml                 # Giao diện mở/đóng ca, kiểm quỹ
│   └── SettingsView.xaml                  # Thiết lập máy in và hệ thống
└── Dialogs/
    ├── GuestCountDialog.xaml              # Chọn số lượng khách khi mở bàn
    ├── ProductOptionDialog.xaml           # Chọn topping, nhóm lựa chọn bắt buộc/tùy chọn
    ├── NumericKeypadDialog.xaml           # Bàn phím số cảm ứng nhập tiền, số lượng
    ├── CancelItemDialog.xaml              # Hủy món đã gửi bếp kèm lý do
    ├── MoveTableDialog.xaml               # Chuyển bàn
    ├── MergeTableDialog.xaml              # Gộp bàn / gộp hóa đơn
    ├── SplitTableDialog.xaml              # Tách bàn / tách món
    ├── PaymentDialog.xaml                 # Modal thanh toán chi tiết
    ├── ExitDialog.xaml                    # Hộp thoại xác nhận thoát ứng dụng an toàn
    └── UpdateDialog.xaml                  # Thông báo cập nhật phiên bản mới
```

---

## 4. QUY TRÌNH XÁC THỰC & SINGLE SIGN-ON NATIVE

### 4.1. Đăng nhập Email/Password Native
1. Người dùng nhập Email và Mật khẩu tại `LoginView.xaml`.
2. Ứng dụng gọi `POST http://127.0.0.1:3001/api/auth/desktop/login`.
3. Backend kiểm tra tài khoản, bcrypt password, kiểm tra `isAccountLocked`, cấp JWT `access_token`.
4. Ứng dụng gọi `GET /api/auth/me` với Bearer Token:
   - Kiểm tra vai trò: `ADMIN` hoặc có quyền `pos.access`.
   - Nếu không có quyền: Thông báo *"Bạn không có quyền truy cập AVORA POS."*, hủy session, giữ nguyên tại màn hình Login.
5. Nếu hợp lệ: Mã hóa token lưu vào Windows DPAPI (`SecureSessionManager.cs`) và chuyển sang `PosShellView.xaml`.

### 4.2. Đăng nhập Google OAuth (External Browser Flow)
1. Người dùng click *"Đăng nhập với Google"*.
2. Ứng dụng mở Browser hệ thống với URL:
   `http://127.0.0.1:3001/api/auth/google?isDesktop=true&redirectURL=avora-pos-native://auth/callback`
3. Backend xác thực Google OAuth thành công, sinh `one-time authorization code` lưu trong cache/DB tạm (hết hạn trong 120s).
4. Trình duyệt chuyển tiếp về URI giao thức riêng:
   `avora-pos-native://auth/callback?code=XYZ`
5. Windows chuyển URI đến instance đang chạy hoặc khởi động `AvoraPosNative.exe`.
6. App Native lấy `code`, gọi `POST /api/auth/desktop/exchange-code` lấy token.
7. Thực hiện xác thực quyền POS và đăng nhập vào `PosShellView`. **Không có JWT truyền trực tiếp trên URI.**

### 4.3. One-Time SSO từ Web sang Native
1. Trên giao diện Web POS, bổ sung nút *"Mở AVORA POS Native"*.
2. Web gọi `POST /api/auth/desktop/launch-code` để backend cấp mã 60 giây.
3. Web kích hoạt URL: `avora-pos-native://open?code=ABC`.
4. App Native nhận mã, gọi `POST /api/auth/desktop/exchange-launch-code`, đối chiếu `deviceId` và đăng nhập an toàn.

---

## 5. BẢNG TIẾN ĐỘ THỰC HIỆN CHI TIẾT (PHASED IMPLEMENTATION)

### Giai đoạn 1: Khởi tạo Project & Thiết lập môi trường độc lập
- Tạo thư mục `desktop/AvoraPosNative/` và file project `AvoraPosNative.csproj` (.NET 8 Windows WPF, tự chứa, không có `Microsoft.Web.WebView2`).
- Sao chép tài nguyên thương hiệu (`Assets/restaurant_bg.png`, `Assets/avora_logo_desktop.png`, `avora_logo_desktop.ico`).
- Cấu hình `App.xaml.cs` với Mutex riêng `AVORA_POS_NATIVE_SINGLE_INSTANCE`, đăng ký protocol `avora-pos-native://`, SingleInstancePipe riêng.
- Cấu hình `AppDataPaths.cs` với đường dẫn thư mục riêng `%LOCALAPPDATA%\AVORA POS Native\`.
- Cấu hình `SecureSessionManager.cs` lưu session DPAPI riêng.

### Giai đoạn 2: Giữ nguyên Native Login & Luồng Authentication
- Xây dựng `LoginView.xaml` với giao diện 1:1 từ `MainWindow.xaml` của app cũ.
- Tích hợp `AuthService.cs` gọi backend `/api/auth/desktop/login` và `/api/auth/me`.
- Cấu hình luồng Google Login mở browser với redirect `avora-pos-native://auth/callback`.
- Hỗ trợ deep-link `avora-pos-native://open?code=...` cho One-time SSO.
- Cửa sổ xác nhận thoát `ExitDialog.xaml` độc lập, an toàn.

### Giai đoạn 3: Xây dựng Shell & Data Layer
- Xây dựng `PosShellView.xaml` và `PosShellViewModel.cs` theo chuẩn phong cách sang trọng Dark Slate (`#0B1120`, `#0F172A`, `#1E293B`) đồng bộ với Web POS.
- Xây dựng `PosApiService.cs` bao quát toàn bộ endpoints `/api/pos/...` (init, products, tables, orders, kitchen, shifts, vouchers, reservations, members).
- Tích hợp `RealtimeService.cs` bằng `SocketIOClient` kết nối namespace `/pos`.

### Giai đoạn 4: Porting toàn bộ phân hệ POS sang Native WPF
1. **Sơ đồ bàn (Table Map)**: Hiển thị sơ đồ theo khu vực (Area tabs), trạng thái trực quan bàn (Trống, Đang có khách, Đã in tạm tính, Đặt trước), thời gian sử dụng, số lượng khách, tổng tiền hiện tại.
2. **Thực đơn món ăn (Product Menu)**: Danh mục sản phẩm, tìm kiếm không dấu tiếng Việt, hiển thị thẻ món, badge bán chạy, món buffet, điều chỉnh trạng thái hết hàng.
3. **Giỏ hàng & Chi tiết đơn (Order Cart)**: Thêm món, chọn tùy chọn/topping (`ProductOptionDialog`), sửa ghi chú, tăng giảm số lượng, chiết khấu món/đơn, áp dụng voucher.
4. **Nghiệp vụ bàn (Table Operations)**: Mở bàn, chọn số khách (`GuestCountDialog`), chuyển bàn (`MoveTableDialog`), gộp bàn (`MergeTableDialog`), tách bàn/tách đơn (`SplitTableDialog`).
5. **Thanh toán (Payment)**: Modal thanh toán tiền mặt (bàn phím số gợi ý mệnh giá, tính tiền thừa), thanh toán mã QR VietQR realtime, thanh toán thẻ.
6. **Bếp / KDS Realtime**: Gửi bếp (`/orders/:id/send-kitchen`), cập nhật trạng thái món (Sent, Preparing, Ready, Served), in phiếu chế biến.
7. **Đặt bàn (Reservation)**: Danh sách lịch đặt hôm nay, tìm kiếm khách đặt, check-in gán bàn.
8. **QR Order tại bàn**: Nhận đơn gọi món QR realtime, duyệt hoặc từ chối lượt gọi món.
9. **Quản lý ca (Cash Shift)**: Mở ca đầu ngày, kiểm đếm số dư đầu ca, đóng ca, ghi nhận chênh lệch tiền mặt.

### Giai đoạn 5: Print Engine Native (ESC/POS & TSPL/ZPL)
- Sao chép và tách biệt các module in ấn từ app cũ vào `desktop/AvoraPosNative/Printing/`:
  - In hóa đơn thanh toán & in tạm tính qua ESC/POS RAW.
  - In phiếu order bếp qua ESC/POS RAW chia theo trạm bếp/bar.
  - In tem nhãn dán ly/hộp qua TSPL/ZPL.
  - Hỗ trợ cả USB (WinSpool RAW) và LAN (TCP Port 9100).
  - Hàng đợi in bền bỉ `PersistentPrintQueue.cs` chống mất lệnh khi mất kết nối.

### Giai đoạn 6: Offline Cache & SQLite Storage
- Thiết lập `LocalDatabase.cs` riêng tại `%LOCALAPPDATA%\AVORA POS Native\Data\avora_pos_native.db`.
- Lưu cache danh mục, sản phẩm, bảng giá và hàng đợi giao dịch offline.

### Giai đoạn 7: Đóng gói Installer & Kiểm thử Song Song
- Viết file cấu hình Inno Setup mới `installer/avora-pos-native-setup.iss`.
- Biên dịch ứng dụng Publish Self-Contained x64: `AvoraPosNative.exe`.
- Biên dịch bộ cài đặt: `AVORA-POS-Native-Setup.exe`.
- Kiểm thử cài đặt đồng thời cả 2 ứng dụng trên cùng một máy tính để xác nhận không bị ghi đè hay xung đột.
