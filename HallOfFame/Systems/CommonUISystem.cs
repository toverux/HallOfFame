using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text.RegularExpressions;
using Colossal.Localization;
using Colossal.PSI.Common;
using Colossal.PSI.PdxSdk;
using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.Settings;
using Game.UI;
using Game.UI.Localization;
using Game.UI.Menu;
using HallOfFame.Utils;
using PDX.ModsUI;
using UnityEngine;
using UnityEngine.Networking;

namespace HallOfFame.Systems;

/// <summary>
/// UI System providing utilities used by various features of the mod.
/// </summary>
internal sealed partial class CommonUISystem : UISystemBase {
  private const string BindingGroup = "hallOfFame.common";

  private readonly LocalizationManager localizationManager =
    GameManager.instance.localizationManager;

  private TriggerBinding<string> openModSettingsBinding = null!;

  private TriggerBinding<string> openWebPageBinding = null!;

  private TriggerBinding<string> openCreatorPageBinding = null!;

  private TriggerBinding<bool, string> logJavaScriptErrorBinding = null!;

  private GetterValueBinding<string> localeBinding = null!;

  private GetterValueBinding<Settings> settingsBinding = null!;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // No need to OnUpdate as there are no bindings that require it, they are manually updated
      // when needed.
      this.Enabled = false;

      this.localeBinding = new GetterValueBinding<string>(
        CommonUISystem.BindingGroup, "locale",
        () => this.localizationManager.activeLocaleId);

      this.settingsBinding = new GetterValueBinding<Settings>(
        CommonUISystem.BindingGroup, "settings",
        () => Mod.Settings,
        comparer: new FakeSettingComparer());

      this.openModSettingsBinding = new TriggerBinding<string>(
        CommonUISystem.BindingGroup, "openModSettings",
        this.OpenModSettings);

      this.openWebPageBinding = new TriggerBinding<string>(
        CommonUISystem.BindingGroup, "openWebPage",
        Application.OpenURL);

      this.openCreatorPageBinding = new TriggerBinding<string>(
        CommonUISystem.BindingGroup, "openCreatorPage",
        this.OpenCreatorPage);

      this.logJavaScriptErrorBinding = new TriggerBinding<bool, string>(
        CommonUISystem.BindingGroup, "logJavaScriptError",
        this.LogJavaScriptError);

      this.AddBinding(this.localeBinding);
      this.AddBinding(this.settingsBinding);
      this.AddBinding(this.openModSettingsBinding);
      this.AddBinding(this.openWebPageBinding);
      this.AddBinding(this.openCreatorPageBinding);
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
  /// Opens the creator page from a URL, either in the in-game Paradox Mods Creator page UI or in
  /// the browser depending on the user's choice.
  /// Even if the page is opened in-game, the click is registered on the server.
  /// </summary>
  private void OpenCreatorPage(string url) {
    var username = Regex.Match(url, "/authors/(?<author>[^/?#]+)").Groups["author"]?.Value;

    if (username is null) {
      Mod.Log.Warn($"Could not extract Paradox Mods username from URL {url}");

      OpenCreatorPageInBrowser();
    }

    switch (Mod.Settings.PrefersOpeningPdxModsInBrowser) {
      case true:
        OpenCreatorPageInBrowser();

        return;
      case false:
        OpenCreatorPageInGame();

        return;
    }

    var dialog = new ConfirmationDialog(
      title: null,
      message: LocalizedString.Id("HallOfFame.Systems.CommonUI.OPEN_PDX_MODS_DIALOG[Message]"),
      confirmAction: LocalizedString.Id(
        "HallOfFame.Systems.CommonUI.OPEN_PDX_MODS_DIALOG[OpenInBrowserAction]"),
      cancelAction: null,
      otherActions: LocalizedString.Id(
        "HallOfFame.Systems.CommonUI.OPEN_PDX_MODS_DIALOG[OpenInGameAction]"));

    GameManager.instance.userInterface.appBindings
      .ShowConfirmationDialog(dialog, OnConfirmOrCancel);

    return;

    void OnConfirmOrCancel(int choice) {
      Mod.Settings.PrefersOpeningPdxModsInBrowser = choice is 0;
      Mod.Settings.ApplyAndSave();

      switch (choice) {
        case 0:
          Application.OpenURL(url);

          break;
        case 2:
          OpenCreatorPageInGame();

          break;
      }
    }

    void OpenCreatorPageInBrowser() {
      Application.OpenURL(url);
    }

    void OpenCreatorPageInGame() {
      try {
        var sdk = PlatformManager.instance.GetPSI<PdxSdkPlatform>("PdxSdk");

        // Get the method "private void ShowModsUI(Action<ModsUIView> showAction)"
        var showModsUi = sdk.GetType().GetMethod(
          "ShowModsUI",
          BindingFlags.Instance | BindingFlags.NonPublic,
          null, CallingConventions.Any,
          [typeof(Action<ModsUIView>)], []);

        showModsUi?.Invoke(sdk, [
          (ModsUIView view) => view.Show(ModsUIScreen.Creator, username)
        ]);

        // Send a GET request to our server so that the click count is still incremented.
        // We don't care about the result, success or not.
        UnityWebRequest.Get(url).SendWebRequest();
      }
      catch (Exception ex) {
        Mod.Log.ErrorRecoverable(ex);

        Application.OpenURL(url);
      }
    }
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
