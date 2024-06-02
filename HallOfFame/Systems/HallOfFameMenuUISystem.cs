using System;
using Colossal.UI.Binding;
using Game.UI;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

/// <summary>
/// System responsible for handling the Hall of Fame UI on the game's main menu.
/// </summary>
public sealed partial class HallOfFameMenuUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame.menu";

    private const string VanillaDefaultImageUri = "Media/Menu/Background2.jpg";

    protected override void OnCreate() {
        base.OnCreate();

        try {
            this.AddBinding(new ValueBinding<string>(
                HallOfFameMenuUISystem.BindingGroup, "currentImageUri",
                HallOfFameMenuUISystem.VanillaDefaultImageUri));
        }
        catch (Exception ex) {
            Mod.Log.ErrorFatal(ex);
        }
    }
}
