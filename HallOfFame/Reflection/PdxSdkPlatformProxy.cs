using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Colossal.PSI.Common;
using Colossal.PSI.PdxSdk;
using PDX.ModsUI;
using PDX.SDK.Contracts;
using PDX.SDK.Contracts.Errors;

namespace HallOfFame.Reflection;

/// <summary>
/// Safe proxies to internal <see cref="PdxSdkPlatform"/> features.
/// </summary>
internal static class PdxSdkPlatformProxy {
  /// <summary>
  /// Paradox SDK instance, it will be null if it was not found.
  /// </summary>
  internal static readonly PdxSdkPlatform? PdxSdk;

  /// <summary>
  /// Field accessor for <c>PdxSdkPlatform.m_AccountUserId</c>.
  /// Null if it was not found.
  /// </summary>
  private static readonly FieldInfo? AccountUserIdField;

  /// <summary>
  /// Method accessor for the private <c>ShowModsUI(Action&lt;ModsUIView&gt;)</c> method.
  /// Null if it was not found.
  /// </summary>
  private static readonly MethodInfo? ShowModsUIMethod;

  /// <summary>
  /// Field accessor for <c>PdxSdkPlatform.m_SDKContext</c>, the Paradox SDK the platform wraps.
  /// Null if it was not found.
  /// </summary>
  private static readonly FieldInfo? SdkContextField;

  static PdxSdkPlatformProxy() {
    PdxSdkPlatformProxy.PdxSdk = PlatformManager.instance.GetPSI<PdxSdkPlatform>("PdxSdk");

    if (PdxSdkPlatformProxy.PdxSdk is null) {
      Mod.Log.ErrorRecoverable(
        new Exception("Failed to get an instance of PdxSdkPlatform PSI instance.")
      );

      return;
    }

    Mod.Log.Verbose($"{nameof(PdxSdkPlatformProxy)}: Acquired PdxSdkPlatform");

    PdxSdkPlatformProxy.AccountUserIdField = typeof(PdxSdkPlatform).GetField(
      "m_AccountUserId",
      BindingFlags.NonPublic | BindingFlags.Instance
    );

    if (PdxSdkPlatformProxy.AccountUserIdField is null) {
      Mod.Log.ErrorRecoverable(
        new Exception("Failed to find field m_AccountUserId in PdxSdkPlatform.")
      );
    }
    else {
      Mod.Log.Verbose($"{nameof(PdxSdkPlatformProxy)}: Acquired PdxSdkPlatform.m_AccountUserId");
    }

    PdxSdkPlatformProxy.ShowModsUIMethod = typeof(PdxSdkPlatform).GetMethod(
      "ShowModsUI",
      BindingFlags.Instance | BindingFlags.NonPublic,
      null,
      CallingConventions.Any,
      [typeof(Action<ModsUIView>)],
      []
    );

    if (PdxSdkPlatformProxy.ShowModsUIMethod is null) {
      Mod.Log.ErrorRecoverable(
        new Exception("Failed to find method ShowModsUI in PdxSdkPlatform.")
      );
    }
    else {
      Mod.Log.Verbose(
        $"{nameof(PdxSdkPlatformProxy)}: Acquired PdxSdkPlatform.ShowModsUI(Action<ModsUIView>)"
      );
    }

    PdxSdkPlatformProxy.SdkContextField = typeof(PdxSdkPlatform).GetField(
      "m_SDKContext",
      BindingFlags.NonPublic | BindingFlags.Instance
    );

    // Logged only: the public playset reader stands in for it.
    if (PdxSdkPlatformProxy.SdkContextField is null) {
      Mod.Log.ErrorSilent("Failed to find field m_SDKContext in PdxSdkPlatform.");
    }
    else {
      Mod.Log.Verbose($"{nameof(PdxSdkPlatformProxy)}: Acquired PdxSdkPlatform.m_SDKContext");
    }
  }

  public static void Init() {
    // Just a method to force-initialize the static constructor.
  }

  /// <summary>
  /// Gets the Paradox account ID of the user.
  /// Null if there was an issue reading the private field, or if the user is not logged in.
  /// </summary>
  internal static string? AccountUserId =>
    PdxSdkPlatformProxy.PdxSdk is not null
      ? PdxSdkPlatformProxy.AccountUserIdField?.GetValue(PdxSdkPlatformProxy.PdxSdk) as string
      : null;

  /// <summary>
  /// Calls the private <c>ShowModsUI(Action&lt;ModsUIView&gt;)</c> method.
  /// </summary>
  /// <exception cref="NullReferenceException">If the method was not found.</exception>
  internal static void ShowModsUI(Action<ModsUIView> showAction) {
    if (PdxSdkPlatformProxy.ShowModsUIMethod is null) {
      throw new NullReferenceException(nameof(PdxSdkPlatformProxy.ShowModsUIMethod));
    }

    PdxSdkPlatformProxy.ShowModsUIMethod.Invoke(PdxSdkPlatformProxy.PdxSdk, [showAction]);
  }

  /// <summary>
  /// Reads the Paradox mod IDs of the active playset's enabled mods, an empty list when no playset
  /// is active.
  /// Null when the playset could not be read (SDK missing or not initialized, SDK error), kept
  /// apart from an empty playset.
  /// Signed out or offline, the SDK still answers from the playsets it keeps on disk.
  /// </summary>
  /// <remarks>
  /// The SDK is asked directly: its result tells a failure from an absent playset, and lists the
  /// IDs without resolving each mod's local details as
  /// <see cref="PdxSdkPlatform.GetModsInActivePlayset"/> does.
  /// That public method stands in when the SDK field could not be reached, with its coarser
  /// answer: null for any error outside the SDK's mod error range, an empty set within it.
  /// </remarks>
  internal static async Task<IReadOnlyList<int>?> ReadActivePlaysetModIds() {
    if (PdxSdkPlatformProxy.PdxSdk is null) {
      return null;
    }

    try {
      if (PdxSdkPlatformProxy.SdkContextField is null) {
        var mods = await PdxSdkPlatformProxy.PdxSdk.GetModsInActivePlayset();

        return mods?.Select(mod => ParseModId(mod.id)).OfType<int>().ToArray();
      }

      // Null before the SDK initializes and after the platform disposes it, where the public reader
      // would throw.
      if (
        PdxSdkPlatformProxy.SdkContextField.GetValue(PdxSdkPlatformProxy.PdxSdk)
        is not IContext context
      ) {
        return null;
      }

      var result = await context.Mods.GetActivePlaysetEnabledMods();

      if (result.Success) {
        return result.Mods.Select(mod => ParseModId(mod.Id)).OfType<int>().ToArray();
      }

      if (result.Error.Code == ModErrorCode.NoActivePlayset) {
        return [];
      }

      Mod.Log.Warn(
        $"{nameof(PdxSdkPlatformProxy)}: Could not read the active playset: {result.Error.Message}"
      );

      return null;
    }
    catch (Exception ex) {
      Mod.Log.Warn(ex, $"{nameof(PdxSdkPlatformProxy)}: Could not read the active playset.");

      return null;
    }

    // Paradox mod IDs are numeric; one that is not is left out.
    static int? ParseModId(string? id) => int.TryParse(id, out var parsed) ? parsed : null;
  }
}
