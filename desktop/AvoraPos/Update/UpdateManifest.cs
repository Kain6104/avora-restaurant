using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace AvoraPos.Update
{
    public class UpdateManifest
    {
        [JsonProperty("version")]
        public string Version { get; set; } = "1.0.0";

        [JsonProperty("build")]
        public int Build { get; set; } = 100;

        [JsonProperty("releaseDate")]
        public string ReleaseDate { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonProperty("updateType")]
        public string UpdateType { get; set; } = "OPTIONAL"; // OPTIONAL, RECOMMENDED, MANDATORY

        [JsonProperty("minimumSupportedVersion")]
        public string MinimumSupportedVersion { get; set; } = "1.0.0";

        [JsonProperty("downloadUrl")]
        public string DownloadUrl { get; set; } = string.Empty;

        [JsonProperty("sha256")]
        public string Sha256 { get; set; } = string.Empty;

        [JsonProperty("fileSize")]
        public long FileSize { get; set; } = 0;

        [JsonProperty("releaseNotes")]
        public List<string> ReleaseNotes { get; set; } = new List<string>();
    }

    public class UpdateCheckResult
    {
        public bool UpdateAvailable { get; set; }
        public bool IsMandatory { get; set; }
        public string CurrentVersion { get; set; } = string.Empty;
        public int CurrentBuild { get; set; }
        public UpdateManifest? Manifest { get; set; }
        public string? Error { get; set; }
    }
}
