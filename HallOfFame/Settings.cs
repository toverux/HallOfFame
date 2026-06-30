using System.Collections.Generic;
using System.IO;
using System.Linq;
using Colossal.IO.AssetDatabase;
using Colossal.PSI.Common;
using Colossal.UI.Binding;
using Game.Input;
using Game.Modding;
using Game.Settings;
using Game.UI.Localization;
using Game.UI.Widgets;
using HallOfFame.Services;
using JetBrains.Annotations;
using UnityEngine;
#if DEBUG
using Colossal;
using Colossal.Json;
using Game.SceneFlow;
using HallOfFame.Systems;
using Unity.Entities;
#endif

namespace HallOfFame;

[FileLocation($"ModsSettings/{nameof(HallOfFame)}/{nameof(HallOfFame)}")]
[SettingsUIShowGroupName(
  Settings.GroupYourProfile,
  Settings.GroupUIPreferences,
  Settings.GroupKeyBindings,
  Settings.GroupContentPreferences,
  Settings.GroupAdvanced,
  Settings.GroupLinks,
  Settings.GroupDevelopment
)]
[SettingsUIKeyboardAction(
  nameof(Settings.KeyBindingForceEnableMainMenuSlideshow),
  Usages.kMenuUsage
)]
[SettingsUIKeyboardAction(nameof(Settings.KeyBindingPrevious), Usages.kMenuUsage)]
[SettingsUIKeyboardAction(nameof(Settings.KeyBindingNext), Usages.kMenuUsage)]
[SettingsUIKeyboardAction(nameof(Settings.KeyBindingLike), Usages.kMenuUsage)]
[SettingsUIKeyboardAction(nameof(Settings.KeyBindingToggleMenu), Usages.kMenuUsage)]
public sealed class Settings : ModSetting, IJsonWritable, ICreatorIdentityStore, IPresenterSettings {
  private const string GroupYourProfile = "YourProfile";

  private const string GroupUIPreferences = "UIPreferences";

  private const string GroupKeyBindings = "KeyBindings";

  private const string GroupContentPreferences = "ContentPreferences";

  private const string GroupAdvanced = "Advanced";

  private const string GroupLinks = "Links";

  private const string GroupDevelopment = "Development";

  // Needs to be getter method to be read by the game.
  private static DropdownItem<string>[] ResolutionDropdownItems => [
    new() { value = "fhd", displayName = "Full HD" },
    new() { value = "4k", displayName = "4K" }
  ];

  // Needs to be getter method to be read by the game.
  private DropdownItem<string>[] TranslationModeDropdownItems => [
    new() {
      value = "translate", displayName = this.GetOptionLabelLocaleID("TranslationMode.Translate")
    },
    new() {
      value = "transliterate",
      displayName = this.GetOptionLabelLocaleID("TranslationMode.Transliterate")
    },
    new() {
      value = "disabled", displayName = this.GetOptionLabelLocaleID("TranslationMode.Disabled")
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
  /// Text explaining the algorithms' weight selection mechanism.
  /// </summary>
  [SettingsUIMultilineText("coui://ui-mods/images/cs2-lightbulb.svg")]
  [UsedImplicitly]
  public string AdvancedSettingsDescription =>
    string.Empty; // The actual text comes from the translation file.

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
  [UsedImplicitly]
  public string? MaskedCreatorID => this.CreatorID is null
    ? null
    : string.Join(
      "-",
      this
        .CreatorID
        .Split('-')
        .Select((segment, index) => index == 0
          ? segment
          : new string('*', segment.Length)
        )
    );

  /// <summary>
  /// Live account status text ("logged in as X", "invalid username", that kind of things).
  /// Updated by the <see cref="CreatorIdentity"/> on mod load and when settings change.
  /// </summary>
  [SettingsUISection(Settings.GroupYourProfile)]
  [UsedImplicitly]
  // ReSharper disable once ConvertToAutoPropertyWithPrivateSetter
  // We could use a private setter to set the text but then the game won't interpret our property as
  // an Option entry, it has to be getter-only.
  public LocalizedString LoginStatus => this.loginStatusValue;

  /// <summary>
  /// Opens https://viewer.halloffame.mtq.io on the Creator's profile page.
  /// </summary>
  [SettingsUISection(Settings.GroupYourProfile)]
  [SettingsUIButton]
  [SettingsUIButtonGroup("Profile")]
  [UsedImplicitly]
  public bool OpenWebViewer {
    // ReSharper disable once ValueParameterNotUsed
    set {
      var creatorQuery = string.IsNullOrWhiteSpace(this.CreatorName)
        ? this.CreatorID
        : this.CreatorName;

      Application.OpenURL(
        $"https://viewer.halloffame.mtq.io/?creator={creatorQuery}&sortOrder=Descending"
      );
    }
  }

  [SettingsUISection(Settings.GroupYourProfile)]
  [SettingsUIButton]
  [SettingsUIButtonGroup("Profile")]
  [UsedImplicitly]
  public bool CopyCreatorID {
    // ReSharper disable once ValueParameterNotUsed
    set => GUIUtility.systemCopyBuffer = this.CreatorID;
  }

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
    nameof(Settings.KeyBindingForceEnableMainMenuSlideshow)
  )]
  [SettingsUIDisableByCondition(
    typeof(Settings),
    nameof(Settings.EnableMainMenuSlideshow)
  )]
  [SettingsUIAdvanced]
  public ProxyBinding KeyBindingForceEnableMainMenuSlideshow { get; set; }

  /// <summary>
  /// Whether to replace the vanilla background image in the loading screen with the last image that
  /// HoF loaded.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  [SettingsUIDisableByCondition(
    typeof(Settings),
    nameof(Settings.EnableMainMenuSlideshow),
    true
  )]
  [SettingsUIAdvanced]
  public bool EnableLoadingScreenBackground { get; set; }

  /// <summary>
  /// Whether to show the featured asset info block in the main menu UI.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  [SettingsUIAdvanced]
  public bool ShowFeaturedAsset { get; set; }

  /// <summary>
  /// Whether to show creators' social links in the main menu UI.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  [SettingsUIAdvanced]
  public bool ShowCreatorSocials { get; set; }

  /// <summary>
  /// Whether to show the view count of screenshots in the main menu UI.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  [SettingsUIAdvanced]
  public bool ShowViewCount { get; set; }

  /// <summary>
  /// Translation mode for city and creator names.
  /// </summary>
  [SettingsUISection(Settings.GroupUIPreferences)]
  [SettingsUIDropdown(
    typeof(Settings),
    nameof(Settings.TranslationModeDropdownItems)
  )]
  public string NamesTranslationMode { get; set; } = null!;

  [SettingsUISection(Settings.GroupKeyBindings)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.LeftArrow,
    nameof(Settings.KeyBindingPrevious)
  )]
  public ProxyBinding KeyBindingPrevious { get; set; }

  [SettingsUISection(Settings.GroupKeyBindings)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.RightArrow,
    nameof(Settings.KeyBindingNext)
  )]
  public ProxyBinding KeyBindingNext { get; set; }

  [SettingsUISection(Settings.GroupKeyBindings)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.L,
    nameof(Settings.KeyBindingLike)
  )]
  public ProxyBinding KeyBindingLike { get; set; }

  [SettingsUISection(Settings.GroupKeyBindings)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.Space,
    nameof(Settings.KeyBindingToggleMenu)
  )]
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
  /// Weight of the popular screenshot selection algorithm.
  /// </summary>
  [SettingsUISection(Settings.GroupContentPreferences)]
  [SettingsUISlider(min = 0, max = 10)]
  public int PopularScreenshotWeight { get; set; }

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
    nameof(Settings.ResolutionDropdownItems)
  )]
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
    true
  )]
  [SettingsUIAdvanced]
  public bool DisableGlobalIllumination { get; set; }

  /// <summary>
  /// Base URL of the Hall of Fame server.
  /// </summary>
  [SettingsUISection(Settings.GroupAdvanced)]
  [SettingsUITextInput]
  [SettingsUIAdvanced]
  [UsedImplicitly]
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
  [UsedImplicitly]
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
    set => Settings.DoDumpTranslations();
  }
  #endif

  /// <summary>
  /// When the user clicks a Paradox Mods link for the first time, they are asked if they want to
  /// open it in the in-game UI or in the default browser. That preference is then saved.
  /// </summary>
  [SettingsUIHidden]
  public string ParadoxModsBrowsingPreference { get; set; } = null!;

  /// <summary>
  /// The latest value the user selected for the "Share playset" option in the upload panel.
  /// It is restored when it opens.
  /// </summary>
  [SettingsUIHidden]
  public bool SavedShareModIdsPreference { get; set; }

  /// <summary>
  /// The latest value the user selected for the "Share photo mode settings" option in the upload
  /// panel.
  /// It is restored when it opens.
  /// </summary>
  [SettingsUIHidden]
  public bool SavedShareRenderSettingsPreference { get; set; }

  /// <summary>
  /// The latest description the user typed in the upload panel.
  /// It is restored when it opens.
  /// </summary>
  [SettingsUIHidden]
  public string? SavedScreenshotDescription { get; set; }

  internal string BaseUrlWithScheme => this.BaseUrl.StartsWith("http")
    ? this.BaseUrl
    : $"https://{this.BaseUrl}";

  /// <seealso cref="LoginStatus"/>
  private LocalizedString loginStatusValue = string.Empty;

  /// <summary>
  /// Writes the live login status surfaced by the getter-only <see cref="LoginStatus"/>.
  /// The public property must stay getter-only, so the game treats it as an Options entry, so the
  /// write-side is exposed only through the <see cref="ICreatorIdentityStore"/> seam that
  /// <see cref="CreatorIdentity"/> drives.
  /// </summary>
  LocalizedString ICreatorIdentityStore.LoginStatus {
    set => this.loginStatusValue = value;
  }

  /// <summary>
  /// Persists the settings on behalf of <see cref="CreatorIdentity"/> through the
  /// <see cref="ICreatorIdentityStore"/> seam.
  /// </summary>
  void ICreatorIdentityStore.Save() => this.ApplyAndSave();

  /// <summary>
  /// Exposes the save directory to <see cref="SlideshowConductor"/> through the
  /// <see cref="IPresenterSettings"/> seam.
  /// <see cref="IPresenterSettings.ScreenshotResolution"/> is satisfied directly by the public
  /// <see cref="ScreenshotResolution"/> property.
  /// </summary>
  string IPresenterSettings.SaveDirectory => this.CreatorsScreenshotSaveDirectory;

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
    // necessarily have a username attached to it. Users only logged in via Paradox (standalone)
    // will have no username set by default and will be asked to set it in the mod's settings when
    // they first upload a screenshot.
    var userName = PlatformManager.instance.userName;

    // Strip leading # from username, Xbox accounts have it.
    this.CreatorName = userName.StartsWith("#") ? userName[1..] : userName;

    this.EnableMainMenuSlideshow = true;
    this.EnableLoadingScreenBackground = true;
    this.ShowFeaturedAsset = true;
    this.ShowCreatorSocials = true;
    this.ShowViewCount = false;

    this.PopularScreenshotWeight = 10;
    this.TrendingScreenshotWeight = 10;
    this.RecentScreenshotWeight = 10;
    this.ArcheologistScreenshotWeight = 0;
    this.RandomScreenshotWeight = 5;
    this.SupporterScreenshotWeight = 1;

    this.ViewMaxAge = 60;
    this.ScreenshotResolution = Screen.width * Screen.height > 1920 * 1080 ? "4k" : "fhd";
    this.NamesTranslationMode = "translate";

    this.CreatorsScreenshotSaveDirectory = Path.GetFullPath(
      Path.Combine(Mod.GameScreenshotsPath, "Hall Of Fame Creators")
    );

    this.CreateLocalScreenshot = true;
    this.DisableGlobalIllumination = Settings.IsNvidiaGpu();
    this.BaseUrl = "halloffame.cs2.mtq.io";

    this.ParadoxModsBrowsingPreference = "undefined";
    this.SavedShareModIdsPreference = true;
    this.SavedShareRenderSettingsPreference = true;
    this.SavedScreenshotDescription = string.Empty;
  }

  internal Settings Clone() => (Settings)this.MemberwiseClone();

  internal static bool IsNvidiaGpu() =>
    SystemInfo.graphicsDeviceVendor.ToLower().Contains("nvidia");

  void IJsonWritable.Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("creatorName");
    writer.Write(this.CreatorName);

    writer.PropertyName("enableLoadingScreenBackground");
    writer.Write(this.EnableLoadingScreenBackground);

    writer.PropertyName("showFeaturedAsset");
    writer.Write(this.ShowFeaturedAsset);

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

    var world = World.All[0];

    world
      .GetOrCreateSystemManaged<PresenterUISystem>()
      .LoadScreenshotById(this.ScreenshotToLoad!);

    this.ScreenshotToLoad = null;
  }

  private static void DoDumpTranslations() {
    var localizationManager = GameManager.instance.localizationManager;
    var originalLocale = localizationManager.activeLocaleId;

    foreach (var locale in localizationManager.GetSupportedLocales()) {
      localizationManager.SetActiveLocale(locale);

      var strings = localizationManager
        .activeDictionary.entries
        .OrderBy(kv => kv.Key)
        .ToDictionary(kv => kv.Key, kv => kv.Value);

      var json = JSON.Dump(strings);

      var filePath = Path.Combine(
        Application.persistentDataPath,
        $"locale-dictionary-{locale}.json"
      );

      File.WriteAllText(filePath, json);
    }

    localizationManager.SetActiveLocale(originalLocale);
  }

  internal sealed class DevDictionarySource : IDictionarySource {
    public IEnumerable<KeyValuePair<string, string>> ReadEntries(
      IList<IDictionaryEntryError> errors,
      Dictionary<string, int> indexCounts
    ) => new Dictionary<string, string> {
      { "Options.GROUP[HallOfFame.HallOfFame.Mod.Development]", "{ Development }" },
      { "Options.OPTION[HallOfFame.HallOfFame.Mod.Settings.ScreenshotToLoad]", "Screenshot ID" },
      { "Options.OPTION[HallOfFame.HallOfFame.Mod.Settings.LoadScreenshot]", "Load Screenshot" }, {
        "Options.OPTION[HallOfFame.HallOfFame.Mod.Settings.DumpTranslations]",
        "Dump Locales as JSON"
      }
    };

    public void Unload() {
    }
  }
  #endif
}
