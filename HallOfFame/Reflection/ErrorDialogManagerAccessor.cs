using System;
using System.Reflection;
using Game.SceneFlow;
using Game.UI;
using HallOfFame.Utils;

namespace HallOfFame.Reflection;

internal static class ErrorDialogManagerAccessor {
  /// <summary>
  /// Instance of the error dialog manager, will be null if there was an error retrieving its
  /// instance through reflection.
  /// </summary>
  internal static ErrorDialogManager? Instance { get; }

  static ErrorDialogManagerAccessor() {
    var appBindings = GameManager.instance.userInterface.appBindings;

    ErrorDialogManagerAccessor.Instance = typeof(AppBindings)
      .GetField(
        "m_ErrorDialogManager",
        BindingFlags.NonPublic | BindingFlags.Instance
      )
      ?.GetValue(appBindings) as ErrorDialogManager;

    if (ErrorDialogManagerAccessor.Instance is null) {
      Mod.Log.ErrorRecoverable(
        new Exception("Failed to get an instance of ErrorDialogManagerAccessor.")
      );
    }
    else {
      Mod.Log.Info(
        $"{nameof(ErrorDialogManagerAccessor)}: Acquired AppBindings.m_ErrorDialogManager"
      );
    }
  }

  public static void Init() {
    // Just a method to force-initialize the static constructor.
  }
}
