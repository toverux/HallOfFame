using System;
using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.UI;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

public sealed partial class HallOfFameUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame";

    private IUpdateBinding? localeBinding;

    protected override void OnCreate() {
        base.OnCreate();

        try {
            this.AddBinding(new TriggerBinding<bool, string>(
                HallOfFameUISystem.BindingGroup, "logJavaScriptError",
                this.LogJavaScriptError));

            this.AddBinding(this.localeBinding = new GetterValueBinding<string>(
                HallOfFameUISystem.BindingGroup, "locale",
                () => GameManager.instance.localizationManager.activeLocaleId));

            GameManager.instance.localizationManager.onActiveDictionaryChanged +=
                this.OnActiveDictionaryChanged;

            // No need to OnUpdate as there are no bindings that require it.
            this.Enabled = false;
        }
        catch (Exception ex) {
            Mod.Log.ErrorFatal(ex);
        }
    }

    protected override void OnDestroy() {
        base.OnDestroy();

        GameManager.instance.localizationManager.onActiveDictionaryChanged -=
            this.OnActiveDictionaryChanged;
    }

    private void OnActiveDictionaryChanged() {
        this.localeBinding?.Update();
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
