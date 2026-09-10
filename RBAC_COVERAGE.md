# BÁO CÁO ĐỘ BAO PHỦ PHÂN QUYỀN (RBAC COVERAGE REPORT)

## Kết quả Kiểm toán Toàn diện (RBAC Audit Summary)

- **Trạng thái**: ✅ **100% COVERAGE PASSED**
- **Tiêu chuẩn kiểm toán**: Zero Unprotected Endpoints, Zero Permission Gaps, Backend Authoritative Default Deny.

| Hạng mục kiểm tra | Tổng số lượng | Số lượng bảo vệ | Tỷ lệ bao phủ | Trạng thái |
| :--- | :---: | :---: | :---: | :---: |
| **Giao diện Quản trị (`/admin/*` Routes)** | 38 | 38 | **100%** | ✅ PASSED |
| **Thanh điều hướng Admin (Sidebar Navigation)** | 23 | 23 | **100%** | ✅ PASSED |
| **Backend REST Controller Endpoints** | 295 | 295 | **100%** | ✅ PASSED |
| **Lệnh WebSocket Gateway (/pos)** | 4 | 4 | **100%** | ✅ PASSED |
| **Mã quyền không xác định (Unknown Keys)** | 0 | 0 | **0** | ✅ PASSED |
| **Mã quyền trùng lặp (Duplicate Keys)** | 0 | 0 | **0** | ✅ PASSED |
| **TỔNG THỂ RBAC COVERAGE** | **360** | **360** | **100.0%** | 🏆 **ENTERPRISE READY** |

---

## 3. Kiến trúc Đa vai trò & Đa chi nhánh (Multi-Role + Multi-Branch)

1. **Nguyên tắc phân giải quyền hạn**:
   ```
   User -> [UserRoleAssignment] -> Role -> [RolePermission] -> Permission
                               -> [UserRoleBranch] -> Branch
   ```
2. **Quyền hạn độc lập theo từng chi nhánh**:
   - Nếu User là **Quản lý** tại `Chi nhánh 1` và **Phục vụ** tại `Chi nhánh 2`:
     - Quyền `orders.refund` chỉ có hiệu lực tại `Chi nhánh 1`.
     - Tại `Chi nhánh 2`, hành động hoàn tiền sẽ bị chặn `403 Forbidden`.
3. **Phạm vi `ALL_BRANCHES` động**:
   - Nhân sự được cấp `ALL_BRANCHES` sẽ tự động nhận phạm vi trên bất kỳ chi nhánh mới nào được mở trong tương lai mà không cần thao tác gán lại thủ công.
   - `ALL_BRANCHES != ADMIN`: Việc mở rộng địa lý chỉ áp dụng cho các quyền mà vai trò đó sở hữu.
4. **Bảo vệ IDOR (Insecure Direct Object Reference)**:
   - Mọi thao tác cập nhật/hủy đơn hàng, bàn ăn, ca thu ngân đều truy vấn trực tiếp thực thể trong DB để lấy `entity.branchId`, sau đó đối chiếu với danh sách chi nhánh được cấp phép của người dùng.
5. **Cập nhật thời gian thực (Real-time Authorization Invalidation)**:
   - Khi Admin thay đổi vai trò hoặc phạm vi của nhân sự, hệ thống phát sự kiện WebSocket `AUTHORIZATION_UPDATED` qua namespace `/pos`. Client ngay lập tức cập nhật `/auth/me/capabilities` mà không cần chờ JWT hết hạn.
