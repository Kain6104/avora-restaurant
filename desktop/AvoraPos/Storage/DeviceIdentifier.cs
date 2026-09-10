using System;
using System.Security.Cryptography;
using System.Text;

namespace AvoraPos.Storage
{
    public static class DeviceIdentifier
    {
        private static string? _cachedId;

        public static string GetHardwareFingerprint()
        {
            if (!string.IsNullOrEmpty(_cachedId)) return _cachedId;

            try
            {
                string raw = $"{Environment.MachineName}|{Environment.UserName}|{Environment.OSVersion}";
                using var sha = SHA256.Create();
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
                _cachedId = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant().Substring(0, 32);
                return _cachedId;
            }
            catch
            {
                _cachedId = Environment.MachineName;
                return _cachedId;
            }
        }
    }
}
