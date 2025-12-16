using System;
using System.Reflection;
using Colossal.PSI.Common;
using Colossal.PSI.PdxSdk;
using HallOfFame.Utils;
using PDX.ModsUI;

namespace HallOfFame.Reflection;

/// <summary>
/// Safe proxies to internal <see cref="PdxSdkPlatform"/> features.
/// </summary>
internal static class PdxSdkPlatformProxy {
  /// <summary>
  /// Paradox SDK instance, will be null if it was not found.
  /// </summary>
  private static readonly PdxSdkPlatform? PdxSdk;

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
  }

  public static void Init() {
    // Just a method to force-initialize the static constructor.
  }

  /// <summary>
  /// Gets the Paradox account ID of the user.
  /// Null if there was an issue reading the private field, or if the user is not logged in.
  /// </summary>
  internal static string? AccountUserId =>
    PdxSdkPlatformProxy.AccountUserIdField?.GetValue(PdxSdkPlatformProxy.PdxSdk) as string;

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
}
