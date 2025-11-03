using System;
using System.Reflection;
using Game.SceneFlow;
using Game.UI;
using HallOfFame.Utils;

namespace HallOfFame.Reflection;

public static class ErrorDialogManagerAccessor {
  /// <summary>
  /// Instance of the error dialog manager, will be null if there was an error retrieving its
  /// instance through reflection.
  /// </summary>
  public static ErrorDialogManager? Instance { get; }

  static ErrorDialogManagerAccessor() {
    var appBindings = GameManager.instance.userInterface.appBindings;

    var errorDialogManager = typeof(AppBindings)
      .GetField(
        "m_ErrorDialogManager",
        BindingFlags.NonPublic | BindingFlags.Instance)
      ?.GetValue(appBindings) as ErrorDialogManager;

    if (errorDialogManager is null) {
      Mod.Log.ErrorRecoverable(
        new Exception($"Failed to get an instance of {nameof(ErrorDialogManagerAccessor)}."));
    }

    ErrorDialogManagerAccessor.Instance = errorDialogManager;
  }
}
