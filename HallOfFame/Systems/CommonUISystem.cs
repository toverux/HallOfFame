using System;
using System.Collections.Generic;
using Colossal.Localization;
using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.Settings;
using Game.UI;
using Game.UI.Localization;
using Game.UI.Menu;
using HallOfFame.Reflection;
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

  private TriggerBinding<int> openModPageBinding = null!;

  private TriggerBinding<string> openCreatorPageBinding = null!;

  private TriggerBinding<string> openViewerLinkBinding = null!;

  private TriggerBinding<string> copyViewerLinkBinding = null!;

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
        CommonUISystem.BindingGroup,
        "locale",
        () => this.localizationManager.activeLocaleId
      );

      this.settingsBinding = new GetterValueBinding<Settings>(
        CommonUISystem.BindingGroup,
        "settings",
        () => Mod.Settings,
        comparer: new FakeSettingComparer()
      );

      this.openModSettingsBinding = new TriggerBinding<string>(
        CommonUISystem.BindingGroup,
        "openModSettings",
        this.OpenModSettings
      );

      this.openWebPageBinding = new TriggerBinding<string>(
        CommonUISystem.BindingGroup,
        "openWebPage",
        Application.OpenURL
      );

      this.openModPageBinding = new TriggerBinding<int>(
        CommonUISystem.BindingGroup,
        "openModPage",
        this.OpenModPage
      );

      this.openCreatorPageBinding = new TriggerBinding<string>(
        CommonUISystem.BindingGroup,
        "openCreatorPage",
        this.OpenCreatorPage
      );

      this.openViewerLinkBinding = new TriggerBinding<string>(
        CommonUISystem.BindingGroup,
        "openViewerLink",
        url => CommonUISystem.RunWebViewerAction(() => Application.OpenURL(url))
      );

      this.copyViewerLinkBinding = new TriggerBinding<string>(
        CommonUISystem.BindingGroup,
        "copyViewerLink",
        url => CommonUISystem.RunWebViewerAction(() => GUIUtility.systemCopyBuffer = url)
      );

      this.logJavaScriptErrorBinding = new TriggerBinding<bool, string>(
        CommonUISystem.BindingGroup,
        "logJavaScriptError",
        this.LogJavaScriptError
      );

      this.AddBinding(this.localeBinding);
      this.AddBinding(this.settingsBinding);
      this.AddBinding(this.openModSettingsBinding);
      this.AddBinding(this.openWebPageBinding);
      this.AddBinding(this.openModPageBinding);
      this.AddBinding(this.openCreatorPageBinding);
      this.AddBinding(this.openViewerLinkBinding);
      this.AddBinding(this.copyViewerLinkBinding);
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

    this.localizationManager.onActiveDictionaryChanged -= this.OnActiveDictionaryChanged;

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
      false
    );
  }

  /// <summary>
  /// Opens a mod's page from an ID, either in the in-game Paradox Mods UI or in the browser
  /// depending on the user's choice.
  /// Even if the page is opened in-game, the click is registered on the server.
  /// </summary>
  private void OpenModPage(int modId) {
    var url = $"{Mod.Settings.BaseUrlWithScheme}/api/v1/mods/{modId}";

    this.OpenParadoxModsPage(
      url,
      () => {
        PdxSdkPlatformProxy.ShowModsUI(view => view.Show(ModsUIScreen.ModDetails, modId));

        // Send a GET request to our server so that the click count is still incremented.
        // We don't care about the result, success or not.
        UnityWebRequest.Get(url).SendWebRequest();
      }
    );
  }

  /// <summary>
  /// Opens the creator page from a URL, either in the in-game Paradox Mods Creator page UI or in
  /// the browser depending on the user's choice.
  /// Even if the page is opened in-game, the click is registered on the server.
  /// </summary>
  private void OpenCreatorPage(string url) {
    this.OpenParadoxModsPage(
      url,
      async void () => {
        try {
          // Resolves the username and increments the click count.
          var username = await Mod.Api.ResolveParadoxModsUsername(url);

          PdxSdkPlatformProxy.ShowModsUI(view => view.Show(ModsUIScreen.Creator, username));
        }
        catch (Exception ex) {
          Mod.Log.ErrorRecoverable(ex);
        }
      }
    );
  }

  private void OpenParadoxModsPage(string url, Action openInGame) {
    switch (Mod.Settings.ParadoxModsBrowsingPreference) {
      case "browser":
        Application.OpenURL(url);

        return;
      case "in-game":
        OpenInGame();

        return;
    }

    var dialog = new ConfirmationDialog(
      null,
      LocalizedString.Id("HallOfFame.Systems.CommonUI.OPEN_PDX_MODS_DIALOG[Message]"),
      LocalizedString.Id("HallOfFame.Systems.CommonUI.OPEN_PDX_MODS_DIALOG[OpenInBrowserAction]"),
      null,
      LocalizedString.Id("HallOfFame.Systems.CommonUI.OPEN_PDX_MODS_DIALOG[OpenInGameAction]")
    );

    GameManager.instance.userInterface.appBindings
      .ShowConfirmationDialog(dialog, OnConfirmOrCancel);

    return;

    // Choice 0 is browser, 1 is cancel, 2 is Paradox Mods in-game UI.
    void OnConfirmOrCancel(int choice) {
      Mod.Settings.ParadoxModsBrowsingPreference = choice is 0 ? "browser" : "in-game";
      Mod.Settings.ApplyAndSave();

      // ReSharper disable once ConvertIfStatementToSwitchStatement
      if (choice is 0) {
        Application.OpenURL(url);
      }
      else if (choice is 2) {
        OpenInGame();
      }
    }

    void OpenInGame() {
      if (PdxSdkPlatformProxy.PdxSdk is null) {
        Application.OpenURL(url);

        return;
      }

      try {
        openInGame();
      }
      catch (Exception ex) {
        Mod.Log.ErrorRecoverable(ex);

        Application.OpenURL(url);
      }
    }
  }

  /// <summary>
  /// Opens or copies a web viewer link, behind the one-time notice telling that the viewer is a
  /// third-party website.
  /// The action is deferred to the dismissal of the notice so that the browser does not steal the
  /// focus from a dialog the player has not read yet.
  /// </summary>
  private static void RunWebViewerAction(Action action) {
    if (Mod.Settings.HasSeenWebViewerDialog) {
      action();

      return;
    }

    var dialog = new MessageDialog(
      LocalizedString.Id("HallOfFame.Systems.CommonUI.WEB_VIEWER_DIALOG[Title]"),
      LocalizedString.Id("HallOfFame.Systems.CommonUI.WEB_VIEWER_DIALOG[Message]"),
      LocalizedString.Id("HallOfFame.Systems.CommonUI.WEB_VIEWER_DIALOG[ConfirmAction]")
    );

    // The notice carries a single acknowledge button and no way to refuse, so its every outcome,
    // that button or an Escape, means the same thing: it has been read, and the action the player
    // asked for goes ahead. Recording it only once the dialog closes leaves it to be shown again
    // if the game quits while it is up.
    GameManager.instance.userInterface.appBindings
      .ShowMessageDialog(dialog, _ => {
        Mod.Settings.HasSeenWebViewerDialog = true;
        Mod.Settings.ApplyAndSave();

        action();
      });
  }

  /// <summary>
  /// Shows an error sent from JavaScript.
  /// </summary>
  private void LogJavaScriptError(bool isFatal, string error) {
    var @base = "HallOfFame.Common.BASE_ERROR".Translate();

    var gravity = isFatal
      ? "HallOfFame.Common.FATAL_ERROR".Translate()
      : "HallOfFame.Common.RECOVERABLE_ERROR".Translate();

    ErrorDialogManagerAccessor.Instance?.ShowError(
      new ErrorDialog {
        localizedMessage = $"{@base} \n{gravity}",
        errorDetails = error
      }
    );

    Mod.Log.ErrorSilent(error);
  }

  private class FakeSettingComparer : EqualityComparer<Settings> {
    public override bool Equals(Settings x, Settings y) => false;

    public override int GetHashCode(Settings settings) => settings.GetHashCode();
  }
}
