using System;
using System.Collections.Generic;
using Colossal.Localization;
using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.Settings;
using Game.UI;
using Game.UI.Menu;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

internal sealed partial class GlobalUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame";

    private readonly LocalizationManager localizationManager =
        GameManager.instance.localizationManager;

    private TriggerBinding<string> openModSettingsBinding = null!;

    private TriggerBinding<bool, string> logJavaScriptErrorBinding = null!;

    private GetterValueBinding<string> localeBinding = null!;

    private GetterValueBinding<Settings> settingsBinding = null!;

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
                () => Mod.Settings,
                comparer: new FakeSettingComparer());

            this.openModSettingsBinding = new TriggerBinding<string>(
                GlobalUISystem.BindingGroup, "openModSettings",
                this.OpenModSettings);

            this.logJavaScriptErrorBinding = new TriggerBinding<bool, string>(
                GlobalUISystem.BindingGroup, "logJavaScriptError",
                this.LogJavaScriptError);

            this.AddBinding(this.localeBinding);
            this.AddBinding(this.settingsBinding);
            this.AddBinding(this.openModSettingsBinding);
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
        this.localeBinding.Update();
    }

    private void OnSettingsApplied(Setting setting) {
        this.settingsBinding.Update();
    }

    /// <summary>
    /// Opens the mod settings page at the specified section.
    /// </summary>
    private void OpenModSettings(string section) {
        var optionsUISystem =
            this.World.GetOrCreateSystemManaged<OptionsUISystem>();

        optionsUISystem.OpenPage(
            "HallOfFame.HallOfFame.Mod",
            $"HallOfFame.HallOfFame.Mod.{section}",
            false);
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

        Mod.Log.ErrorSilent(error);
    }

    private class FakeSettingComparer : EqualityComparer<Settings> {
        public override bool Equals(Settings x, Settings y) => false;

        public override int GetHashCode(Settings settings) =>
            settings.GetHashCode();
    }
}
