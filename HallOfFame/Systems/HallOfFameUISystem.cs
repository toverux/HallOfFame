using Colossal.UI.Binding;
using Game.UI;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

public sealed partial class HallOfFameUISystem : UISystemBase {
    protected override void OnCreate() {
        base.OnCreate();

        this.AddBinding(new TriggerBinding<bool, string>(
            "hallOfFame", "logJavaScriptError", this.LogJavaScriptError));

        // No need to OnUpdate as there are no bindings that require it.
        this.Enabled = false;
    }

    /// <summary>
    /// Shows an error sent from JavaScript.
    /// </summary>
    private void LogJavaScriptError(bool isFatal, string error) {
        var @base = "HallOfFame.Common.BASE_ERROR".Translate();
        var gravity = isFatal
            ? "HallOfFame.Common.FATAL_ERROR".Translate()
            : "HallOfFame.Common.RECOVERABLE_ERROR".Translate();

        ErrorDialogManager.ShowErrorDialog(new ErrorDialog {
            localizedMessage = $"{@base} \n{gravity}",
            errorDetails = error
        });

        var prevShowsErrorsInUI = Mod.Log.showsErrorsInUI;
        Mod.Log.showsErrorsInUI = false;

        Mod.Log.Error(error);

        Mod.Log.showsErrorsInUI = prevShowsErrorsInUI;
    }
}
