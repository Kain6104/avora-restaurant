using System;
using System.Collections.Generic;

namespace AvoraPosNative.Models
{
    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponse
    {
        public bool Success { get; set; }
        public string? AccessToken { get; set; }
        public UserProfile? User { get; set; }
        public string? Message { get; set; }
    }

    public class UserProfile
    {
        public string Id { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new();
        public string? AvatarUrl { get; set; }
        public bool IsAccountLocked { get; set; }
        public bool HasPosAccess { get; set; } = false;
        public List<string> Permissions { get; set; } = new();
        public Dictionary<string, PermissionScope> EffectivePermissions { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public string? CurrentBranchId { get; set; }
        public string? CurrentBranchName { get; set; }

        public bool HasPermission(string permissionKey, string? branchId = null)
        {
            if (IsAccountLocked) return false;
            
            // Check ADMIN role
            if (Role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase) || 
                Roles.Exists(r => r.Equals("ADMIN", StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }

            // Check EffectivePermissions dictionary
            if (EffectivePermissions.TryGetValue(permissionKey, out var scope))
            {
                if (scope.IsGlobal) return true;
                if (!string.IsNullOrEmpty(branchId))
                {
                    return scope.BranchIds.Contains(branchId);
                }
                if (!string.IsNullOrEmpty(CurrentBranchId))
                {
                    return scope.BranchIds.Contains(CurrentBranchId);
                }
                return scope.BranchIds.Count > 0;
            }

            // Fallback to legacy permissions list
            return Permissions.Contains(permissionKey, StringComparer.OrdinalIgnoreCase);
        }
    }

    public class PermissionScope
    {
        public bool IsGlobal { get; set; }
        public List<string> BranchIds { get; set; } = new();
    }
}
