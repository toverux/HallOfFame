using Colossal.UI.Binding;
using Game.UI;

namespace HallOfFame.Systems;

/// <summary>
/// System responsible for handling the Hall of Fame UI on the game's main menu.
/// </summary>
public sealed partial class HallOfFameMenuUISystem : UISystemBase {
    private const string VanillaDefaultImageUri = "Media/Menu/Background2.jpg";

    protected override void OnCreate() {
        base.OnCreate();

        this.AddUpdateBinding(new GetterValueBinding<string>(
            "hallOfFame.menu", "currentImageUri",
            () => HallOfFameMenuUISystem.VanillaDefaultImageUri));
    }
}
