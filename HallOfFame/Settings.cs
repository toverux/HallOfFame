using System;
using System.IO;
using System.Linq;
using Colossal.IO.AssetDatabase;
using Colossal.PSI.Common;
using Colossal.UI.Binding;
using Game.Modding;
using Game.Settings;
using Game.UI.Widgets;
using HarmonyLib;
using JetBrains.Annotations;
using UnityEngine;

namespace HallOfFame;

[FileLocation($"ModsSettings/{nameof(HallOfFame)}/{nameof(HallOfFame)}")]
[SettingsUIShowGroupName(
    Settings.GroupYourProfile,
    Settings.GroupContentPreferences,
    Settings.GroupAdvanced)]
public sealed class Settings : ModSetting, IJsonWritable {
    private const string GroupYourProfile = "YourProfile";

    private const string GroupContentPreferences = "ContentPreferences";

    private const string GroupAdvanced = "Advanced";

    private const string GroupOthers = "Others";

    /// <summary>
    /// Creator ID read from the dedicated file.
    /// It's shared among all instances and initialized only once.
    /// </summary>
    public static string? CreatorID { get; private set; }

    private static readonly string CreatorIDFilePath =
        Path.Combine(Mod.ModSettingsPath, "CreatorID.txt");

    private static bool IsCreatorIDDisabled => true;

    private static DropdownItem<string>[] ResolutionDropdownItems => [
        new DropdownItem<string> { value = "fhd", displayName = "Full HD" },
        new DropdownItem<string> { value = "4k", displayName = "4K" }
    ];

    /// <summary>
    /// Creator username.
    /// It can technically be empty, but this is not allowed server-side, so any
    /// UI interacting with the server should check for this.
    /// </summary>
    [SettingsUISection(Settings.GroupYourProfile)]
    [SettingsUITextInput]
    public string CreatorName { get; set; } = null!;

    /// <summary>
    /// Masked Creator ID, only the first segment is shown in the Options UI,
    /// and it is not editable.
    /// </summary>
    [SettingsUISection(Settings.GroupYourProfile)]
    [SettingsUITextInput]
    [SettingsUIDisableByCondition(
        typeof(Settings),
        nameof(Settings.IsCreatorIDDisabled))]
    public string MaskedCreatorID { get; set; } = null!;

    /// <summary>
    /// Button to copy the Creator ID to the clipboard.
    /// </summary>
    [SettingsUISection(Settings.GroupYourProfile)]
    [SettingsUIButton]
    [UsedImplicitly]
    public bool CopyCreatorID {
        // ReSharper disable once ValueParameterNotUsed
        set => GUIUtility.systemCopyBuffer = Settings.CreatorID;
    }

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
    [SettingsUISection(Settings.GroupOthers)]
    [UsedImplicitly]
    public bool ResetSettings {
        // ReSharper disable once ValueParameterNotUsed
        set => this.SetDefaults();
    }

    public Settings(IMod mod) : base(mod) {
        this.SetDefaults();
    }

    /// <summary>
    /// Applies default values to the settings if it's not already done inline.
    /// Do NOT move properties initialization out from this method, as it's used
    /// to restore default values.
    /// </summary>
    public override void SetDefaults() {
        Settings.CreatorID ??= this.CreateOrReadCreatorID();

        // Set the default creator name with the current platform username,
        // might be Steam username or probably the Paradox one for example.
        // I don't know exactly how this works when using a non-Steam version
        // and I don't handle username change (PlatformManager.onUserUpdated)
        // (ex. logging in in-game), because I can't test it.
        // So, let's not bring too much complexity for now, this seems adequate.
        this.CreatorName = PlatformManager.instance.userName ?? string.Empty;

        // Mask the Creator ID except the first segment so the user can
        // identify themselves.
        this.MaskedCreatorID = Settings.CreatorID
            .Split('-')
            .Select((segment, index) => index == 0
                ? segment
                : new string('*', segment.Length))
            .Join(delimiter: "-");

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
    /// Attempts to read the Creator ID file, or creates it if it does not
    /// exist or if the GUID in it is not valid.
    /// </summary>
    /// <returns></returns>
    private string CreateOrReadCreatorID() {
        try {
            // Parse trims the string and is resilient to no-perfectly-formatted
            // GUIDs.
            return Guid.Parse(
                File.ReadAllText(Settings.CreatorIDFilePath)).ToString();
        }
        catch (Exception ex) {
            if (ex is not IOException or FormatException) {
                throw;
            }

            Mod.Log.Warn(
                ex,
                "Cannot open or parse Creator ID file at " +
                $"\"{Settings.CreatorIDFilePath}\", " +
                "attempting to create it.");

            var guid = Guid.NewGuid().ToString();

            File.WriteAllText(Settings.CreatorIDFilePath, guid);

            return guid;
        }
    }

    void IJsonWritable.Write(IJsonWriter writer) {
        writer.TypeBegin(this.GetType().FullName);

        writer.PropertyName("creatorName");
        writer.Write(this.CreatorName);

        writer.PropertyName("creatorIdClue");
        writer.Write(this.MaskedCreatorID.Split('-')[0]);

        writer.PropertyName("screenshotResolution");
        writer.Write(this.ScreenshotResolution);

        writer.TypeEnd();
    }
}
