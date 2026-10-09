using System;

namespace AvoraPos.Models
{
    /// <summary>
    /// Thông tin nhận diện tài khoản đăng nhập gần nhất trên máy tính (Không lưu mật khẩu).
    /// Được bảo vệ an toàn bằng Windows DPAPI (CurrentUser).
    /// </summary>
    public class RememberedAccount
    {
        public string UserId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? CachedAvatarPath { get; set; }
        public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Lấy ký tự viết tắt đại diện cho người dùng khi không có ảnh đại diện (Ví dụ: "H", "P").
        /// </summary>
        public string GetInitialLetter()
        {
            if (!string.IsNullOrWhiteSpace(FullName))
            {
                string trimmed = FullName.Trim();
                // Lấy chữ cái đầu của từ cuối cùng hoặc từ đầu tiên
                string[] parts = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length > 0 && parts[0].Length > 0)
                {
                    return char.ToUpperInvariant(parts[0][0]).ToString();
                }
            }

            if (!string.IsNullOrWhiteSpace(Email))
            {
                return char.ToUpperInvariant(Email.Trim()[0]).ToString();
            }

            return "A";
        }
    }
}
