using Colossal.IO.AssetDatabase;
using Game.Modding;
using Game.Settings;
using JetBrains.Annotations;

namespace HallOfFame;

[FileLocation($"ModsSettings/{nameof(HallOfFame)}/{nameof(HallOfFame)}")]
public sealed class Settings(IMod mod) : ModSetting(mod) {
    /// <summary>
    /// Creator username.
    /// It can be empty. Then the UI should show a string akin to "Anonymous".
    /// </summary>
    [SettingsUITextInput]
    public string CreatorName { get; [UsedImplicitly] set; } = string.Empty;

    /// <summary>
    /// Whether to inhibit the vanilla screenshot capture or not, when taking
    /// a screenshot with Hall of Fame.
    /// </summary>
    public bool MakePlatformScreenshots { get; [UsedImplicitly] set; } = true;

    /// <summary>
    /// Hostname of the Hall of Fame server.
    /// </summary>
    [SettingsUITextInput]
    public string HostName { get; set; } = "halloffame.cs2.mtq.io";

    public override void SetDefaults() {
        // noop
    }
}
