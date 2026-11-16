using System;
using System.Runtime.InteropServices;
using System.Security;
using Game.SceneFlow;
using HallOfFame.Services;
using Microsoft.Win32;
using UnityEngine;

namespace HallOfFame.Utils;

/// <summary>
/// Reads, once at startup, what an error report says of the machine and the build.
/// Each field is read on its own guard: one that fails is left out and blocks nothing, and no game
/// type is read later, when a report is built, as a broken game API is what the reports are for.
/// </summary>
internal static class ErrorContextReader {
  /// <summary>
  /// The device class of display adapters, under which Windows keeps each adapter's driver.
  /// </summary>
  private const string DisplayAdaptersKey =
    @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";

  internal static ErrorContext Read(UsageSession session) {
    var gpuName = ErrorContextReader.Guard(static () => SystemInfo.graphicsDeviceName);

    return new ErrorContext {
      ModVersion = session.ModVersion,
      GameVersion = session.GameVersion,
      IsDebug = session.IsDebug,
      Platform = ErrorContextReader.Guard(static () => SystemInfo.operatingSystem),
      IsWine = ErrorContextReader.Guard(ErrorContextReader.IsWine),
      ScreenWidth = ErrorContextReader.Guard(static () => Screen.width),
      ScreenHeight = ErrorContextReader.Guard(static () => Screen.height),
      GpuName = gpuName,
      GpuVendor = ErrorContextReader.Guard(static () => SystemInfo.graphicsDeviceVendor),
      GpuDriverVersion = gpuName is null
        ? null
        : ErrorContextReader.Guard(() => ErrorContextReader.ReadGpuDriverVersion(gpuName)),
      Locale = ErrorContextReader.Guard(static () =>
        GameManager.instance.localizationManager.activeLocaleId
      )
    };
  }

  /// <summary>
  /// The player's profile folder, ex. <c>C:\Users\Name</c>, or an empty string when it cannot be
  /// read.
  /// </summary>
  internal static string ReadProfilePath() =>
    ErrorContextReader.Guard(static () =>
      Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)
    ) ??
    "";

  /// <summary>
  /// Whether the game runs under Wine, Proton included: Wine's <c>ntdll.dll</c> exports
  /// <c>wine_get_version</c>, which Windows' does not.
  /// </summary>
  private static bool IsWine() {
    var ntdll = ErrorContextReader.GetModuleHandle("ntdll.dll");

    return
      ntdll != IntPtr.Zero &&
      ErrorContextReader.GetProcAddress(ntdll, "wine_get_version") != IntPtr.Zero;
  }

  /// <summary>
  /// The driver version Windows records for the display adapter named <paramref name="gpuName"/>,
  /// as Unity does not expose it, or <c>null</c> when no adapter of that name is found.
  /// </summary>
  private static string? ReadGpuDriverVersion(string gpuName) {
    using var adaptersKey = Registry.LocalMachine.OpenSubKey(ErrorContextReader.DisplayAdaptersKey);

    if (adaptersKey is null) {
      return null;
    }

    foreach (var adapterKeyName in adaptersKey.GetSubKeyNames()) {
      try {
        using var adapterKey = adaptersKey.OpenSubKey(adapterKeyName);

        if (
          adapterKey?.GetValue("DriverDesc") is string description &&
          string.Equals(description.Trim(), gpuName.Trim(), StringComparison.OrdinalIgnoreCase)) {
          return adapterKey.GetValue("DriverVersion") as string;
        }
      }
      // The class key also holds a Properties key a standard user may not open.
      catch (SecurityException) {
      }
      catch (UnauthorizedAccessException) {
      }
    }

    return null;
  }

  private static string? Guard(Func<string?> read) {
    try {
      return read();
    }
    catch {
      return null;
    }
  }

  private static T? Guard<T>(Func<T> read) where T : struct {
    try {
      return read();
    }
    catch {
      return null;
    }
  }

  [DllImport("kernel32", CharSet = CharSet.Unicode, EntryPoint = "GetModuleHandleW")]
  private static extern IntPtr GetModuleHandle(string moduleName);

  // Exported in ANSI alone, as are the names it looks up.
  [DllImport("kernel32", CharSet = CharSet.Ansi, ExactSpelling = true)]
  private static extern IntPtr GetProcAddress(IntPtr module, string procName);
}
