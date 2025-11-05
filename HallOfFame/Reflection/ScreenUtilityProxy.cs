using System;
using System.Reflection;
using Colossal;
using HallOfFame.Utils;

namespace HallOfFame.Reflection;

/// <summary>
/// Safe proxies to internal <see cref="ScreenUtility"/> features.
/// </summary>
internal static class ScreenUtilityProxy {
  /// <summary>
  /// Field accessor for <c>ScreenUtility.m_Count</c>.
  /// Null if it was not found.
  /// </summary>
  private static readonly FieldInfo? CountField;

  private static int countFallback;

  static ScreenUtilityProxy() {
    ScreenUtilityProxy.CountField = typeof(ScreenUtility).GetField(
      "m_Count",
      BindingFlags.NonPublic | BindingFlags.Static);

    if (ScreenUtilityProxy.CountField is null) {
      Mod.Log.ErrorRecoverable(
        new Exception("Failed to find field m_Count in ScreenUtility."));
    }
    else {
      Mod.Log.Verbose($"{nameof(ScreenUtilityProxy)}: Acquired ScreenUtility.m_Count");
    }
  }

  public static void Init() {
    // Just a method to force-initialize the static constructor.
  }

  /// <summary>
  /// Sets and gets the value of <c>ScreenUtility.m_Count</c>.
  /// Returns zero and sets nothing if the field was not found.
  /// </summary>
  internal static int Count {
    get => ScreenUtilityProxy.CountField is null
      ? ScreenUtilityProxy.countFallback
      : (int)ScreenUtilityProxy.CountField.GetValue(null);
    set {
      if (ScreenUtilityProxy.CountField is null) {
        ScreenUtilityProxy.countFallback = value;
      }
      else {
        ScreenUtilityProxy.CountField.SetValue(null, value);
      }
    }
  }
}
