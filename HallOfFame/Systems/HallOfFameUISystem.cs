using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.UI;

namespace HallOfFame.Systems;

public partial class HallOfFameUISystem : UISystemBase {
    protected override void OnCreate() {
        base.OnCreate();

        this.AddBinding(new TriggerBinding("hallOfFame", "takeScreenshot", this.TakeScreenshot));
    }

    private void TakeScreenshot() {
        // The function we'd like to call is PhotoModeUISystem.TakeScreenshot().
        // This is the highest-level vanilla function to take a screenshot, the
        // one called by the Take Picture button.
        // Unfortunately, it's private. We could call it directly using
        // reflection or use the vanilla UI binding.
        // Either seem hacky, but using the binding seems better since it's more
        // public-y since it's made available to modders.
        GameManager.instance.userInterface.view.View.TriggerEvent("photoMode.takeScreenshot");

        Mod.Log.Info("TakeScreenshot called.");
    }
}
