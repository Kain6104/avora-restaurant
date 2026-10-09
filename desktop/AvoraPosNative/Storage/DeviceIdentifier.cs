using System;
using System.Security.Cryptography;
using System.Text;

namespace AvoraPosNative.Storage
{
    public static class DeviceIdentifier
    {
        private static string? _cachedId;

        public static string GetHardwareFingerprint()
        {
            if (!string.IsNullOrEmpty(_cachedId)) return _cachedId;

            try
            {
                string raw = $"{Environment.MachineName}|{Environment.UserName}|{Environment.OSVersion}|AVORA_POS_NATIVE";
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

        public static string GetMachineId()
        {
            string fp = GetHardwareFingerprint();
            return fp.Length >= 16 ? fp.Substring(0, 16).ToUpperInvariant() : fp.ToUpperInvariant();
        }
    }
}
