using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Colossal.IO.AssetDatabase;
using Colossal.PSI.Common;
using Colossal.PSI.PdxSdk;
using Colossal.UI.Binding;
using Game.Input;
using Game.Modding;
using Game.SceneFlow;
using Game.Settings;
using Game.UI;
using Game.UI.Localization;
using Game.UI.Widgets;
using HallOfFame.Http;
using HallOfFame.Utils;
using JetBrains.Annotations;
using UnityEngine;

namespace HallOfFame;

[FileLocation($"ModsSettings/{nameof(HallOfFame)}/{nameof(HallOfFame)}")]
[SettingsUIShowGroupName(
  Settings.GroupYourProfile,
  Settings.GroupUIPreferences,
  Settings.GroupKeyBindings,
  Settings.GroupContentPreferences,
  Settings.GroupAdvanced,
  Settings.GroupLinks,
  Settings.GroupDevelopment)]
[SettingsUIKeyboardAction(
  nameof(Settings.KeyBindingForceEnableMainMenuSlideshow), Usages.kMenuUsage)]
[SettingsUIKeyboardAction(
  nameof(Settings.KeyBindingPrevious), Usages.kMenuUsage)]
[SettingsUIKeyboardAction(
  nameof(Settings.KeyBindingNext), Usages.kMenuUsage)]
[SettingsUIKeyboardAction(
  nameof(Settings.KeyBindingLike), Usages.kMenuUsage)]
[SettingsUIKeyboardAction(
  nameof(Settings.KeyBindingToggleMenu), Usages.kMenuUsage)]
public sealed class Settings : ModSetting, IJsonWritable {
  private const string GroupYourProfile = "YourProfile";

  private const string GroupUIPreferences = "UIPreferences";

  private const string GroupKeyBindings = "KeyBindings";

  private const string GroupContentPreferences = "ContentPreferences";

  private const string GroupAdvanced = "Advanced";

  private const string GroupLinks = "Links";

  private const string GroupDevelopment = "Development";

  private static readonly PdxSdkPlatform PdxSdk =
    PlatformManager.instance.GetPSI<PdxSdkPlatform>("PdxSdk");

  // Needs to be getter method to be read by the game.
  private static DropdownItem<string>[] ResolutionDropdownItems => [
    new() { value = "fhd", displayName = "Full HD" },
    new() { value = "4k", displayName = "4K" }
  ];

  // Needs to be getter method to be read by the game.
  private DropdownItem<string>[] TranslationModeDropdownItems => [
    new() {
      value = "translate",
      displayName = this.GetOptionLabelLocaleID("TranslationMode.Translate")
    },
    new() {
      value = "transliterate",
      displayName = this.GetOptionLabelLocaleID("TranslationMode.Transliterate")
    },
    new() {
      value = "disabled",
      displayName = this.GetOptionLabelLocaleID("TranslationMode.Disabled")
    }
  ];

  /// <summary>
  /// The unique identifier of the creator, used to identify and authorize them.
  /// Similar in use to an API key.
  /// The default is the Paradox account UUID ("GUID"), which is actually private.
  /// If not available, a random UUID is generated the first time the mod is run and this value
  /// isn't set.
  /// </summary>
  [SettingsUIHidden]
  public string? CreatorID { get; set; }

  /// <summary>
  /// Stores whether the <see cref="CreatorID"/> was acquired from the Paradox account or generated
  /// locally, communicated to the server for possible future use.
  /// </summary>
  [SettingsUIHidden]
  public bool IsParadoxAccountID { get; set; }

  /// <summary>
  /// Creator username.
  /// Although the UI asks the user to set one when uploading an image, just because it's nicer,
  /// it is not mandatory and can be left null/empty.
  /// Its default value is the "current platform" username, which at the moment will only be a Steam
  /// username if Steam is used, in other cases it will be null, and in any cases the user can
  /// change it anytime.
  /// </summary>
  [SettingsUISection(Settings.GroupYourProfile)]
  [SettingsUITextInput]
  public string? CreatorName { get; set; }

  /// <summary>
  /// Masked Creator ID, only the first segment is shown in the Options UI, and it is not editable.
  /// </summary>
  [SettingsUISection(Settings.GroupYourProfile)]
  public string? MaskedCreatorID => this.CreatorID is null
    ? null
    : string.Join("-", this.CreatorID
      .Split('-')
      .Select((segment, index) => index == 0
        ? segment
        : new string('*', segment.Length)));

  /// <summary>
  /// Live account status text ("logged in as X", "invalid username", that kind of things).
  /// Updated by <see cref="UpdateCreator"/> on mod load and creator name change.
  /// </summary>
  [SettingsUISection(Settings.GroupYourProfile)]
  [UsedImplicitly]
  // ReSharper disable once ConvertToAutoPropertyWithPrivateSetter
  // We could use a private setter to set the text but then the game won't interpret our property as
  // an Option entry, it has to be getter-only.
  public LocalizedString LoginStatus => this.loginStatusValue;

  /// <summary>
  /// Whether to enable HoF on the main menu UI.
  /// It can be useful to disable the mod temporarily or when you only want to use its other
  /// features.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  public bool EnableMainMenuSlideshow { get; set; }

  /// <summary>
  /// Hotkey to force-enable the main menu slideshow if <see cref="EnableMainMenuSlideshow"/> is
  /// disabled.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.H,
    nameof(Settings.KeyBindingForceEnableMainMenuSlideshow))]
  [SettingsUIDisableByCondition(
    typeof(Settings),
    nameof(Settings.EnableMainMenuSlideshow))]
  public ProxyBinding KeyBindingForceEnableMainMenuSlideshow { get; set; }

  /// <summary>
  /// Whether to replace the vanilla background image in the loading screen with the last image that
  /// HoF loaded.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  [SettingsUIDisableByCondition(
    typeof(Settings),
    nameof(Settings.EnableMainMenuSlideshow),
    invert: true)]
  public bool EnableLoadingScreenBackground { get; set; }

  /// <summary>
  /// Whether to show creators' social links in the main menu UI.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  public bool ShowCreatorSocials { get; set; }

  /// <summary>
  /// Whether to show the view count of screenshots in the main menu UI.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  public bool ShowViewCount { get; set; }

  /// <summary>
  /// Translation mode for city and creator names.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  [SettingsUIDropdown(
    typeof(Settings),
    nameof(Settings.TranslationModeDropdownItems))]
  public string NamesTranslationMode { get; set; } = null!;

  [SettingsUISection(Settings.GroupKeyBindings)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.LeftArrow,
    nameof(Settings.KeyBindingPrevious))]
  public ProxyBinding KeyBindingPrevious { get; set; }

  [SettingsUISection(Settings.GroupKeyBindings)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.RightArrow,
    nameof(Settings.KeyBindingNext))]
  public ProxyBinding KeyBindingNext { get; set; }

  [SettingsUISection(Settings.GroupKeyBindings)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.L,
    nameof(Settings.KeyBindingLike))]
  public ProxyBinding KeyBindingLike { get; set; }

  [SettingsUISection(Settings.GroupKeyBindings)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.Space,
    nameof(Settings.KeyBindingToggleMenu))]
  public ProxyBinding KeyBindingToggleMenu { get; set; }

  /// <summary>
  /// Text explaining the algorithms' weight selection mechanism.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUIMultilineText]
  [UsedImplicitly]
  public string WeightsDescription =>
    string.Empty; // The actual text comes from the translation file.

  /// <summary>
  /// Weight of the trending screenshot selection algorithm.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUISlider(min = 0, max = 10)]
  public int TrendingScreenshotWeight { get; set; }

  /// <summary>
  /// Weight of the recent screenshot selection algorithm.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUISlider(min = 0, max = 10)]
  public int RecentScreenshotWeight { get; set; }

  /// <summary>
  /// Weight of the low-views screenshot selection algorithm.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUISlider(min = 0, max = 10)]
  public int ArcheologistScreenshotWeight { get; set; }

  /// <summary>
  /// Weight of the random screenshot selection algorithm.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUISlider(min = 0, max = 10)]
  public int RandomScreenshotWeight { get; set; }

  /// <summary>
  /// Weight of the supporter screenshot selection algorithm.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUISlider(min = 0, max = 10)]
  public int SupporterScreenshotWeight { get; set; }

  /// <summary>
  /// Text separator for other content preferences.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUIMultilineText]
  [UsedImplicitly]
  public string OtherContentPreferences =>
    string.Empty; // The actual text comes from the translation files.

  /// <summary>
  /// The minimum time in days before a screenshot the user has already seen is eligible to be shown
  /// again.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUISlider(min = 0, max = 365, step = 5)]
  public int ViewMaxAge { get; set; }

  /// <summary>
  /// Resolution of downloaded screenshots.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUIDropdown(
    typeof(Settings),
    nameof(Settings.ResolutionDropdownItems))]
  public string ScreenshotResolution { get; set; } = null!;

  /// <summary>
  /// Where to save other creators' screenshots downloaded from the main menu.
  /// </summary>
  [SettingsUISection(Settings.GroupAdvanced)]
  [SettingsUIDirectoryPicker]
  public string CreatorsScreenshotSaveDirectory { get; set; } = null!;

  /// <summary>
  /// Whether to create a PNG file of the screenshot when it is taken, like the vanilla screenshot
  /// feature.
  /// </summary>
  [SettingsUISection(Settings.GroupAdvanced)]
  public bool CreateLocalScreenshot { get; set; }

  /// <summary>
  /// Whether to disable global illumination (while the screenshot is taken) due to the grainy
  /// picture bug that happens on most (?) setups and is hideous, especially with supersampling.
  /// </summary>
  [SettingsUISection(Settings.GroupAdvanced)]
  [SettingsUIHideByCondition(
    typeof(Settings),
    nameof(Settings.IsNvidiaGpu),
    invert: true)]
  public bool DisableGlobalIllumination { get; set; }

  /// <summary>
  /// Base URL of the Hall of Fame server.
  /// </summary>
  [SettingsUISection(Settings.GroupAdvanced)]
  [SettingsUITextInput]
  public string BaseUrl { get; set; } = null!;

  [SettingsUIButton]
  [SettingsUISection(Settings.GroupAdvanced)]
  [UsedImplicitly]
  public bool ResetSettings {
    // ReSharper disable once ValueParameterNotUsed
    set {
      this.SetDefaults();
      this.ApplyAndSave();
    }
  }

  [SettingsUIButton]
  [SettingsUIButtonGroup("Links")]
  [SettingsUISection(Settings.GroupLinks)]
  [UsedImplicitly]
  public bool DiscordLink {
    // ReSharper disable once ValueParameterNotUsed
    set => Application.OpenURL("https://discord.gg/HTav7ARPs2");
  }

  [SettingsUIButton]
  [SettingsUIButtonGroup("Links")]
  [SettingsUISection(Settings.GroupLinks)]
  [UsedImplicitly]
  public bool DonateLink {
    // ReSharper disable once ValueParameterNotUsed
    set => Application.OpenURL("https://paypal.me/MorganTouverey");
  }

  [SettingsUIButton]
  [SettingsUIButtonGroup("Links")]
  [SettingsUISection(Settings.GroupLinks)]
  [UsedImplicitly]
  public bool CrowdinLink {
    // ReSharper disable once ValueParameterNotUsed
    set =>
      Application.OpenURL("https://crowdin.com/project/halloffame-cs2");
  }

  [SettingsUIButton]
  [SettingsUIButtonGroup("Links")]
  [SettingsUISection(Settings.GroupLinks)]
  [UsedImplicitly]
  public bool UserFeedbackLink {
    // ReSharper disable once ValueParameterNotUsed
    set => Application.OpenURL("https://feedback.halloffame.cs2.mtq.io");
  }

  [SettingsUIButton]
  [SettingsUIButtonGroup("Links")]
  [SettingsUISection(Settings.GroupLinks)]
  [UsedImplicitly]
  public bool GithubLink {
    // ReSharper disable once ValueParameterNotUsed
    set => Application.OpenURL("https://github.com/toverux/HallOfFame");
  }

  #if DEBUG
  [SettingsUISection(Settings.GroupDevelopment)]
  [SettingsUITextInput]
  public string? ScreenshotToLoad {
    get;
    [UsedImplicitly]
    set;
  }

  [SettingsUIButton]
  [SettingsUISection(Settings.GroupDevelopment)]
  [UsedImplicitly]
  public bool LoadScreenshot {
    // ReSharper disable once ValueParameterNotUsed
    set => this.DoLoadScreenshot();
  }

  [SettingsUIButton]
  [SettingsUISection(Settings.GroupDevelopment)]
  [UsedImplicitly]
  public bool DumpTranslations {
    // ReSharper disable once ValueParameterNotUsed
    set => this.DoDumpTranslations();
  }

  #endif

  [SettingsUIHidden]
  public bool? PrefersOpeningPdxModsInBrowser { get; set; }

  internal string BaseUrlWithScheme => this.BaseUrl.StartsWith("http")
    ? $"{this.BaseUrl}"
    : $"https://{Mod.Settings.BaseUrl}";

  /// <seealso cref="LoginStatus"/>
  private LocalizedString loginStatusValue = string.Empty;

  /// <seealso cref="UpdateCreator"/>
  private CancellationTokenSource? updateLoginStatusCts;

  public Settings(IMod mod) : base(mod) {
    this.SetDefaults();
  }

  /// <summary>
  /// <para>
  /// Applies default values to the settings if it's not already done inline.
  /// Do NOT move the properties' initialization out from this method, as it's used to restore
  /// default values.
  /// </para>
  /// <para>
  /// Note: the only thing we won't touch here is the Creator ID stuff, as it is supposed to stay
  /// permanent even if the user resets their settings using our reset button.
  /// </para>
  /// </summary>
  public override void SetDefaults() {
    // Set the default creator name with the current platform username.
    // The "platform username" comes from Steam or Xbox GamePass, and not the Paradox account
    // username.
    // Even if there existed a fallback to the Paradox username, a Paradox account does not
    // necessarily have a username attached to it, so users only logged in via Paradox (standalone)
    // will have no username set by default and will be asked to set it in the mod's settings when
    // they first upload a screenshot.
    var userName = PlatformManager.instance.userName;

    // Strip leading # from username, Xbox accounts have it.
    this.CreatorName = userName.StartsWith("#")
      ? userName.Substring(1)
      : userName;

    this.EnableMainMenuSlideshow = true;
    this.EnableLoadingScreenBackground = true;
    this.ShowCreatorSocials = true;
    this.ShowViewCount = false;

    this.TrendingScreenshotWeight = 10;
    this.RecentScreenshotWeight = 5;
    this.ArcheologistScreenshotWeight = 2;
    this.RandomScreenshotWeight = 2;
    this.SupporterScreenshotWeight = 2;

    this.ViewMaxAge = 60;
    this.ScreenshotResolution = "fhd";
    this.NamesTranslationMode = "translate";

    this.CreatorsScreenshotSaveDirectory = Path.GetFullPath(
      Path.Combine(Mod.GameScreenshotsPath, "Hall Of Fame Creators"));

    this.CreateLocalScreenshot = true;
    this.DisableGlobalIllumination = Settings.IsNvidiaGpu();
    this.BaseUrl = "halloffame.cs2.mtq.io";

    this.PrefersOpeningPdxModsInBrowser = null;
  }

  /// <summary>
  /// Method to call on the Settings instance that is actually used by the Options panel (i.e., not
  /// the default settings reference instance).
  /// </summary>
  public void Initialize() {
    #if DEBUG
    GameManager.instance.localizationManager.AddSource(
      "en-US", new DevDictionarySource());
    #endif

    this.InitializeCreatorId();

    // Update the login status when the mod is being loaded.
    this.UpdateCreator(nameOnly: false, silent: false, debounce: false);

    // Update the login status when the Creator Name is changed.
    var prevCreatorName = this.CreatorName;

    this.onSettingsApplied += _ => {
      this.UpdateCreator(
        nameOnly: prevCreatorName != this.CreatorName,
        silent: prevCreatorName == this.CreatorName,
        debounce: true);

      prevCreatorName = this.CreatorName;
    };
  }

  private static bool IsNvidiaGpu() =>
    SystemInfo.graphicsDeviceVendor.ToLower().Contains("nvidia");

  /// <summary>
  /// Initializes <see cref="CreatorID"/>, <see cref="IsParadoxAccountID"/> and
  /// <see cref="MaskedCreatorID"/> with the Paradox account ID, or a locally generated fallback ID
  /// if the user is not logged in or an error occurs.
  /// Shows a warning dialog if the user is not logged in.
  /// </summary>
  private void InitializeCreatorId() {
    // If the Creator ID is already set and valid, we just leave it be.
    if (Guid.TryParse(this.CreatorID, out _)) {
      return;
    }

    // Try to get and store the Paradox account ID.
    // Why store it?
    // 1. If the user once plays without Internet connection or server failure, we'll still have the
    //    ID used previously.
    // 2. If for some reason the user changes the Paradox account they use, it doesn't mean they
    //    want to change their Hall of Fame account, so we keep the old ID.
    // 3. It's more explicit and transparent to the user.
    try {
      this.CreatorID = typeof(PdxSdkPlatform)
        .GetField(
          "m_AccountUserId",
          BindingFlags.NonPublic | BindingFlags.Instance)
        ?.GetValue(Settings.PdxSdk) as string;

      if (this.CreatorID is null) {
        this.ShowNoParadoxConnectionWarningDialog();

        throw new Exception("User is not logged in to Paradox.");
      }

      this.IsParadoxAccountID = true;

      Mod.Log.Info(
        $"Settings: Acquired Paradox account ID {this.MaskedCreatorID}.");
    }

    // If the user is not logged in, or the operation failed unexpectedly, we generate a random ID.
    catch (Exception ex) {
      this.CreatorID = Guid.NewGuid().ToString();
      this.IsParadoxAccountID = false;

      Mod.Log.Warn(
        ex,
        $"Settings: Could not acquire Paradox account ID, using a " +
        $"random ID as a fallback ({this.MaskedCreatorID}).");
    }

    // Explicitly save the settings so they're written to disk asap.
    this.ApplyAndSave();
  }

  /// <summary>
  /// Show a warning dialog to the user warning them that they are not using their Paradox account
  /// ID.
  /// </summary>
  private void ShowNoParadoxConnectionWarningDialog() {
    ErrorDialogManager.ShowErrorDialog(new ErrorDialog {
      severity = ErrorDialog.Severity.Warning,
      localizedTitle = LocalizedString.Id("HallOfFame.Settings.PARADOX_LOGIN_DIALOG[Title]"),
      localizedMessage = LocalizedString.Id("HallOfFame.Settings.PARADOX_LOGIN_DIALOG[Message]"),
      actions = ErrorDialog.Actions.None
    });
  }

  /// <summary>
  /// Checks and/or updates the account name with the server and reflect the status in the Options
  /// UI (success or errors if there are any problems, ex. an incorrect username).
  /// </summary>
  /// <param name="nameOnly">
  /// If true, only update the name, not other info (currently: mod settings).
  /// </param>
  /// <param name="silent">
  /// Whether to update the login status text with loading/success/error messages.
  /// </param>
  /// <param name="debounce">
  /// Whether to debounce the method if it's called multiple times in a short period (keystrokes
  /// while typing username).
  /// </param>
  // ReSharper disable once AsyncVoidMethod
  private async void UpdateCreator(
    bool nameOnly,
    bool silent,
    bool debounce) {
    // Cancel any ongoing update.
    this.updateLoginStatusCts?.Cancel();

    var thisCts = this.updateLoginStatusCts = new CancellationTokenSource();

    if (!silent) {
      // Show a loading message while we're fetching the status.
      this.loginStatusValue = LocalizedString.Id("HallOfFame.Common.LOADING");
    }

    try {
      if (debounce) {
        // Apply a delay to debounce the method if it's called multiple
        // times in a short period (keystrokes while typing username).
        await Task.Delay(500, thisCts.Token);
      }

      // Fetch the creator info from the server, this will also update the
      // Creator Name if it's different from the server's.
      var creator = nameOnly
        ? await HttpQueries.GetMe()
        : await HttpQueries.UpdateMe();

      Mod.Log.Info($"Logged in as {creator.CreatorName}. Your Public Creator ID is {creator.Id}.");

      // Stop if the operation was canceled while we were fetching data.
      thisCts.Token.ThrowIfCancellationRequested();

      // Update the login status text with a success message.
      var isAnonymous = string.IsNullOrEmpty(creator.CreatorName);

      if (!silent) {
        this.loginStatusValue = new LocalizedString(
          isAnonymous
            ? "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAnonymously]"
            : "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAs]",
          isAnonymous
            ? "Anonymously logged in."
            : "Logged in as {CREATOR_NAME}.",
          new Dictionary<string, ILocElement> {
            { "CREATOR_NAME", LocalizedString.Value(creator.CreatorName) }
          });
      }
    }
    catch (Exception ex) {
      // Stop if the Task.Delay or the network request was canceled.
      if (ex is OperationCanceledException) {
        return;
      }

      if (silent) {
        Mod.Log.ErrorSilent(ex, "Settings: Failed to update creator.");
      }
      else {
        // Update the login status text with an error message.
        this.loginStatusValue = ex.GetUserFriendlyMessage();
      }
    }
    finally {
      // Clear the shared cancellation token source if we're the last one
      // to have been called.
      if (thisCts == this.updateLoginStatusCts) {
        this.updateLoginStatusCts = null;
      }
    }
  }

  void IJsonWritable.Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("creatorName");
    writer.Write(this.CreatorName);

    writer.PropertyName("creatorIdClue");
    writer.Write(this.MaskedCreatorID?.Split('-')[0]);

    writer.PropertyName("enableLoadingScreenBackground");
    writer.Write(this.EnableLoadingScreenBackground);

    writer.PropertyName("showCreatorSocials");
    writer.Write(this.ShowCreatorSocials);

    writer.PropertyName("showViewCount");
    writer.Write(this.ShowViewCount);

    writer.PropertyName("namesTranslationMode");
    writer.Write(this.NamesTranslationMode);

    writer.PropertyName("screenshotResolution");
    writer.Write(this.ScreenshotResolution);

    writer.PropertyName("creatorsScreenshotSaveDirectory");
    writer.Write(this.CreatorsScreenshotSaveDirectory);

    writer.PropertyName("baseUrl");
    writer.Write(this.BaseUrlWithScheme);

    writer.TypeEnd();
  }

  #if DEBUG
  private void DoLoadScreenshot() {
    if (string.IsNullOrWhiteSpace(this.ScreenshotToLoad)) {
      return;
    }

    var world = Unity.Entities.World.All[0];

    world.GetOrCreateSystemManaged<Systems.PresenterUISystem>()
      .LoadScreenshotById(this.ScreenshotToLoad!);

    this.ScreenshotToLoad = null;
  }

  private void DoDumpTranslations() {
    var localizationManager = GameManager.instance.localizationManager;
    var originalLocale = localizationManager.activeLocaleId;

    foreach (var locale in localizationManager.GetSupportedLocales()) {
      localizationManager.SetActiveLocale(locale);

      var strings = localizationManager.activeDictionary.entries
        .OrderBy(kv => kv.Key)
        .ToDictionary(kv => kv.Key, kv => kv.Value);

      var json = Colossal.Json.JSON.Dump(strings);

      var filePath = Path.Combine(
        Application.persistentDataPath,
        $"locale-dictionary-{locale}.json");

      File.WriteAllText(filePath, json);
    }

    localizationManager.SetActiveLocale(originalLocale);
  }

  private sealed class DevDictionarySource : Colossal.IDictionarySource {
    public IEnumerable<KeyValuePair<string, string>> ReadEntries(
      IList<Colossal.IDictionaryEntryError> errors,
      Dictionary<string, int> indexCounts) =>
      new Dictionary<string, string> {
        {
          "Options.GROUP[HallOfFame.HallOfFame.Mod.Development]",
          "{ Development }"
        }, {
          "Options.OPTION[HallOfFame.HallOfFame.Mod.Settings.ScreenshotToLoad]",
          "Screenshot ID"
        }, {
          "Options.OPTION[HallOfFame.HallOfFame.Mod.Settings.LoadScreenshot]",
          "Load Screenshot"
        }, {
          "Options.OPTION[HallOfFame.HallOfFame.Mod.Settings.DumpTranslations]",
          "Dump Locales as JSON"
        }
      };

    public void Unload() {
    }
  }
  #endif
}
