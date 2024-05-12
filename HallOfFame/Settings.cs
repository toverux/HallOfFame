using Colossal.IO.AssetDatabase;
using Game.Modding;
using Game.Settings;
using JetBrains.Annotations;

namespace HallOfFame;

[FileLocation(nameof(HallOfFame))]
public sealed class Settings(IMod mod) : ModSetting(mod) {
    [SettingsUITextInput, UsedImplicitly]
    public string HostName { get; set; } = "halloffame.cs2.mtq.io";

    public override void SetDefaults() {
        // noop
    }
}
