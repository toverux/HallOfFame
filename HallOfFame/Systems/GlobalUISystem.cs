using System;
using Colossal.Localization;
using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.Settings;
using Game.UI;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

internal sealed partial class GlobalUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame";

    private readonly LocalizationManager localizationManager =
        GameManager.instance.localizationManager;

    private TriggerBinding<bool, string>? logJavaScriptErrorBinding;

    private GetterValueBinding<string>? localeBinding;

    private GetterValueBinding<Settings>? settingsBinding;

    protected override void OnCreate() {
        base.OnCreate();

        try {
            // No need to OnUpdate as there are no bindings that require it,
            // they are manually updated when needed.
            this.Enabled = false;

            this.localeBinding = new GetterValueBinding<string>(
                GlobalUISystem.BindingGroup, "locale",
                () => this.localizationManager.activeLocaleId);

            this.settingsBinding = new GetterValueBinding<Settings>(
                GlobalUISystem.BindingGroup, "settings",
                () => Mod.Settings);

            this.logJavaScriptErrorBinding = new TriggerBinding<bool, string>(
                GlobalUISystem.BindingGroup, "logJavaScriptError",
                this.LogJavaScriptError);

            this.AddBinding(this.localeBinding);
            this.AddBinding(this.settingsBinding);
            this.AddBinding(this.logJavaScriptErrorBinding);

            this.localizationManager.onActiveDictionaryChanged +=
                this.OnActiveDictionaryChanged;

            Mod.Settings.onSettingsApplied += this.OnSettingsApplied;
        }
        catch (Exception ex) {
            Mod.Log.ErrorFatal(ex);
        }
    }

    protected override void OnDestroy() {
        base.OnDestroy();

        this.localizationManager.onActiveDictionaryChanged -=
            this.OnActiveDictionaryChanged;

        Mod.Settings.onSettingsApplied -= this.OnSettingsApplied;
    }

    private void OnActiveDictionaryChanged() {
        this.localeBinding?.Update();
    }

    private void OnSettingsApplied(Setting setting) {
        this.settingsBinding?.Update();
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
