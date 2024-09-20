using System;
using System.Linq;
using System.Reflection;
using Colossal.IO.AssetDatabase;
using Colossal.PSI.Common;
using Colossal.PSI.PdxSdk;
using Colossal.UI.Binding;
using Game.Modding;
using Game.SceneFlow;
using Game.Settings;
using Game.UI;
using Game.UI.Localization;
using Game.UI.Widgets;
using HarmonyLib;
using JetBrains.Annotations;
using UnityEngine;

namespace HallOfFame;

[FileLocation($"ModsSettings/{nameof(HallOfFame)}/{nameof(HallOfFame)}")]
[SettingsUIShowGroupName(
    Settings.GroupYourProfile,
    Settings.GroupContentPreferences,
    Settings.GroupAdvanced,
    Settings.GroupLinks)]
public sealed class Settings : ModSetting, IJsonWritable {
    private const string GroupYourProfile = "YourProfile";

    private const string GroupContentPreferences = "ContentPreferences";

    private const string GroupAdvanced = "Advanced";

    private const string GroupLinks = "Links";

    private static readonly PdxSdkPlatform PdxSdk =
        PlatformManager.instance.GetPSI<PdxSdkPlatform>("PdxSdk");

    private static DropdownItem<string>[] ResolutionDropdownItems => [
        new() { value = "fhd", displayName = "Full HD" },
        new() { value = "4k", displayName = "4K" }
    ];

    /// <summary>
    /// The unique identifier of the creator, used to identify and authorize
    /// them. Similar in use to an API key.
    /// The default is the Paradox account UUID ("GUID"), which is actually
    /// private.
    /// If not available, a random UUID is generated the first time the mod is
    /// run and this value isn't set.
    /// </summary>
    [SettingsUIHidden]
    public string? CreatorID { get; set; }

    /// <summary>
    /// Stores whether the <see cref="CreatorID"/> was acquired from the Paradox
    /// account or generated locally, communicated to the server for possible
    /// future use.
    /// </summary>
    [SettingsUIHidden]
    public bool IsParadoxAccountID { get; set; }

    /// <summary>
    /// Creator username.
    /// Although the UI asks the user to set one when uploading an image,
    /// just because it's nicer, it is not mandatory and can be left null/empty.
    /// Its default value is the "current platform" username, which at the
    /// moment will only be a Steam username if Steam is used, in other cases it
    /// will be null and in any cases the user can change it anytime.
    /// </summary>
    [SettingsUISection(Settings.GroupYourProfile)]
    [SettingsUITextInput]
    public string? CreatorName { get; set; }

    /// <summary>
    /// Masked Creator ID, only the first segment is shown in the Options UI,
    /// and it is not editable.
    /// </summary>
    [SettingsUISection(Settings.GroupYourProfile)]
    public string? MaskedCreatorID => this.CreatorID
        ?.Split('-')
        .Select((segment, index) => index == 0
            ? segment
            : new string('*', segment.Length))
        .Join(delimiter: "-");

    /// <summary>
    /// Text explaining the algorithms' weight selection mechanism.
    /// </summary>
    [SettingsUISection(Settings.GroupContentPreferences)]
    [SettingsUIMultilineText]
    [UsedImplicitly]
    public string WeightsDescription =>
        string.Empty; // The actual text comes from the translations files.

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
        string.Empty; // The actual text comes from the translations files.

    /// <summary>
    /// Minimum time in days before a screenshot the user has already seen is
    /// eligible to be shown again.
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
    /// Whether to inhibit the vanilla screenshot capture or not, when taking
    /// a screenshot with Hall of Fame.
    /// </summary>
    [SettingsUISection(Settings.GroupAdvanced)]
    public bool MakePlatformScreenshots { get; set; }

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
    [SettingsUISection(Settings.GroupLinks)]
    [UsedImplicitly]
    public bool DiscordLink {
        // ReSharper disable once ValueParameterNotUsed
        set => Application.OpenURL("https://discord.gg/HTav7ARPs2");
    }

    [SettingsUIButton]
    [SettingsUISection(Settings.GroupLinks)]
    [UsedImplicitly]
    public bool DonateLink {
        // ReSharper disable once ValueParameterNotUsed
        set => Application.OpenURL("https://paypal.me/MorganTouverey");
    }

    [SettingsUIButton]
    [SettingsUISection(Settings.GroupLinks)]
    [UsedImplicitly]
    public bool CrowdinLink {
        // ReSharper disable once ValueParameterNotUsed
        set =>
            Application.OpenURL("https://crowdin.com/project/halloffame-cs2");
    }

    [SettingsUIButton]
    [SettingsUISection(Settings.GroupLinks)]
    [UsedImplicitly]
    public bool UserFeedbackLink {
        // ReSharper disable once ValueParameterNotUsed
        set => Application.OpenURL("https://feedback.halloffame.cs2.mtq.io");
    }

    [SettingsUIButton]
    [SettingsUISection(Settings.GroupLinks)]
    [UsedImplicitly]
    public bool GithubLink {
        // ReSharper disable once ValueParameterNotUsed
        set => Application.OpenURL("https://github.com/toverux/HallOfFame");
    }

    public Settings(IMod mod) : base(mod) {
        this.SetDefaults();
    }

    /// <summary>
    /// <para>
    /// Applies default values to the settings if it's not already done inline.
    /// Do NOT move properties initialization out from this method, as it's used
    /// to restore default values.
    /// </para>
    /// <para>
    /// Note: the only thing we won't touch here is the Creator ID stuff, as it
    /// is supposed to stay permanent even if the user resets their settings
    /// using our reset button.
    /// </para>
    /// </summary>
    public override void SetDefaults() {
        // Set the default creator name with the current platform username.
        // For now only Steam seems supported, and a Paradox account does not
        // necessarily have a username attached to it so it will be expected
        // that non-Steam users will have to set their username manually.
        this.CreatorName = PlatformManager.instance.userName;

        this.RecentScreenshotWeight = 5;
        this.ArcheologistScreenshotWeight = 5;
        this.RandomScreenshotWeight = 5;
        this.SupporterScreenshotWeight = 10;

        this.ViewMaxAge = 60;
        this.ScreenshotResolution = "fhd";

        this.MakePlatformScreenshots = true;

        this.BaseUrl = "halloffame.cs2.mtq.io";
    }

    /// <summary>
    /// Initializes <see cref="CreatorID"/>, <see cref="IsParadoxAccountID"/>
    /// and <see cref="MaskedCreatorID"/> with the Paradox account ID, or a
    /// fallback locally-generated ID if the user is not logged in or an error
    /// occurs.
    /// Shows a warning dialog if the user is not logged in.
    /// </summary>
    public void InitializeCreatorId() {
        // If the Creator ID is already set and valid, we just leave it be.
        if (Guid.TryParse(this.CreatorID, out _)) {
            return;
        }

        // Try to get and store the Paradox account ID.
        // Why store it?
        // 1. If the user once plays without Internet connection or server
        //    failure, we'll still have the previously-used ID.
        // 2. If for some reason the user change the Paradox account they use,
        //    it doesn't mean they want to change their Hall of Fame account,
        //    so we keep the old ID.
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
                $"Acquired Paradox account ID {this.MaskedCreatorID}.");
        }

        // If the user is not logged in, or the operation failed in an
        // unexpected way, we generate a random ID.
        catch (Exception ex) {
            this.CreatorID = Guid.NewGuid().ToString();
            this.IsParadoxAccountID = false;

            Mod.Log.Warn(
                ex,
                $"Could not acquire Paradox account ID, using a random ID as " +
                $"a fallback ({this.MaskedCreatorID}).");
        }

        // Explicitly save the settings so they're written to disk asap.
        this.ApplyAndSave();
    }

    /// <summary>
    /// Show a warning dialog to the user warning them that they are not using
    /// their Paradox account ID.
    /// </summary>
    private void ShowNoParadoxConnectionWarningDialog() {
        // We also delay the dialog so localization files are loaded, as this
        // code can be run before I18n EveryWhere is loaded.
        GameManager.instance.RegisterUpdater(() => {
            ErrorDialogManager.ShowErrorDialog(new ErrorDialog {
                severity = ErrorDialog.Severity.Warning,
                localizedTitle = LocalizedString.IdWithFallback(
                    "HallOfFame.Settings.PARADOX_LOGIN_DIALOG[Title]",
                    "Welcome to Hall of Fame!"),
                localizedMessage = LocalizedString.IdWithFallback(
                    "HallOfFame.Settings.PARADOX_LOGIN_DIALOG[Message]",
                    """
                    Hall of Fame could not use your Paradox account ID as you do not appear to be logged in.
                    A random Creator ID was generated for you.
                    """),
                actions = ErrorDialog.Actions.None
            });
        });
    }

    void IJsonWritable.Write(IJsonWriter writer) {
        writer.TypeBegin(this.GetType().FullName);

        writer.PropertyName("creatorName");
        writer.Write(this.CreatorName);

        writer.PropertyName("creatorIdClue");
        writer.Write(this.MaskedCreatorID?.Split('-')[0]);

        writer.PropertyName("screenshotResolution");
        writer.Write(this.ScreenshotResolution);

        writer.TypeEnd();
    }
}
