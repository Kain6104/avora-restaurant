using System;

namespace AvoraPosNative.Models
{
    public class RememberedAccount
    {
        public string UserId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? CachedAvatarPath { get; set; }
        public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;

        public string GetInitialLetter()
        {
            if (string.IsNullOrWhiteSpace(FullName))
                return "A";

            string trimmed = FullName.Trim();
            string[] parts = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 0)
            {
                string lastWord = parts[parts.Length - 1];
                if (!string.IsNullOrEmpty(lastWord))
                {
                    return char.ToUpperInvariant(lastWord[0]).ToString();
                }
            }

            return char.ToUpperInvariant(trimmed[0]).ToString();
        }
    }
}

