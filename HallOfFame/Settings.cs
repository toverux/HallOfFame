using Colossal.IO.AssetDatabase;
using Game.Modding;
using Game.Settings;

namespace HallOfFame;

[FileLocation(nameof(HallOfFame))]
public sealed class Settings(IMod mod) : ModSetting(mod) {
    /// <summary>
    /// Whether to inhibit the vanilla screenshot capture or not, when taking
    /// a screenshot with Hall of Fame.
    /// </summary>
    public bool MakePlatformScreenshots { get; set; } = true;

    /// <summary>
    /// Hostname of the Hall of Fame server.
    /// </summary>
    [SettingsUITextInput]
    public string HostName { get; set; } = "halloffame.cs2.mtq.io";

    public override void SetDefaults() {
        // noop
    }
}
