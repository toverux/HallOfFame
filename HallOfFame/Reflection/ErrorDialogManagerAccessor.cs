using System;
using System.Reflection;
using Game.SceneFlow;
using Game.UI;
using Game.UI.Localization;

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
      Mod.Log.Verbose(
        $"{nameof(ErrorDialogManagerAccessor)}: Acquired AppBindings.m_ErrorDialogManager"
      );
    }
  }

  public static void Init() {
    // Just a method to force-initialize the static constructor.
  }

  /// <summary>
  /// Shows a message in the game's error dialog under the given title, Continue as its only action.
  /// Nothing shows when the manager could not be reached.
  /// </summary>
  internal static void ShowError(
    LocalizedString message,
    string title = "HallOfFame.Common.OOPS"
  ) =>
    ErrorDialogManagerAccessor.Instance?.ShowError(
      new ErrorDialog {
        localizedTitle = title,
        localizedMessage = message,
        actions = ErrorDialog.ActionBits.Continue
      }
    );
}
