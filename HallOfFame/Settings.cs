using System;
using System.IO;
using System.Linq;
using Colossal.IO.AssetDatabase;
using Colossal.PSI.Common;
using Colossal.PSI.Environment;
using Colossal.UI.Binding;
using Game.Modding;
using Game.Settings;
using HarmonyLib;
using JetBrains.Annotations;
using UnityEngine;

namespace HallOfFame;

[FileLocation($"ModsSettings/{nameof(HallOfFame)}/{nameof(HallOfFame)}")]
[SettingsUIShowGroupName(Settings.GroupYourProfile, Settings.GroupAdvanced)]
public sealed class Settings : ModSetting, IJsonWritable {
    private const string GroupYourProfile = "YourProfile";
    private const string GroupAdvanced = "Advanced";
    private const string GroupOthers = "Others";

    /// <summary>
    /// Creator ID read from the dedicated file.
    /// It's shared among all instances and initialized only once.
    /// </summary>
    public static string? CreatorID { get; private set; }

    private static readonly string ModsSettingsPath =
        Path.Combine(EnvPath.kUserDataPath, "ModsSettings", nameof(HallOfFame));

    private static readonly string CreatorIDFilePath =
        Path.Combine(Settings.ModsSettingsPath, "CreatorID.txt");

    private static bool IsCreatorIDDisabled => true;

    /// <summary>
    /// Creator username.
    /// It can be empty. Then the UI should show a string akin to "Anonymous".
    /// </summary>
    [SettingsUISection(Settings.GroupYourProfile)]
    [SettingsUITextInput]
    public string CreatorName {
        get;
        [UsedImplicitly]
        set;
    } = null!;

    [SettingsUISection(Settings.GroupYourProfile)]
    [SettingsUITextInput]
    [SettingsUIDisableByCondition(typeof(Settings), nameof(Settings.IsCreatorIDDisabled))]
    public string MaskedCreatorID {
        [UsedImplicitly]
        get;
        set;
    } = null!;

    [SettingsUISection(Settings.GroupYourProfile)]
    [SettingsUIButton]
    [UsedImplicitly]
    public bool CopyCreatorID {
        // ReSharper disable once ValueParameterNotUsed
        set => GUIUtility.systemCopyBuffer = Settings.CreatorID;
    }

    /// <summary>
    /// Whether to inhibit the vanilla screenshot capture or not, when taking
    /// a screenshot with Hall of Fame.
    /// </summary>
    [SettingsUISection(Settings.GroupAdvanced)]
    public bool MakePlatformScreenshots {
        get;
        [UsedImplicitly]
        set;
    }

    /// <summary>
    /// Hostname of the Hall of Fame server.
    /// </summary>
    [SettingsUISection(Settings.GroupAdvanced)]
    [SettingsUITextInput]
    public string HostName {
        get;
        [UsedImplicitly]
        set;
    } = null!;

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
        // (ex. logging in in-game), because I can't test it, in any case we'd
        // need to implement it intelligently to not override empty strings from
        // creators that choose to stay anonymous. So, let's not bring too much
        // complexity for now, this seems adequate.
        this.CreatorName = PlatformManager.instance.userName ?? string.Empty;

        // Mask the Creator ID except the first segment so the user can
        // identify themselves.
        this.MaskedCreatorID = Settings.CreatorID
            .Split('-')
            .Select((segment, index) => index == 0
                ? segment
                : new string('*', segment.Length))
            .Join(delimiter: "-");

        this.MakePlatformScreenshots = true;

        this.HostName = "halloffame.cs2.mtq.io";
    }

    /// <summary>
    /// Attempts to read the Creator ID file, or creates it if it does not
    /// exist or if the GUID in it is not valid.
    /// </summary>
    /// <returns></returns>
    private string CreateOrReadCreatorID() {
        Directory.CreateDirectory(Settings.ModsSettingsPath);

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

        writer.TypeEnd();
    }
}
