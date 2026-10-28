using System.Collections.Generic;
using Game.SceneFlow;
using Game.UI;
using Game.UI.Localization;
using HallOfFame.Reflection;

namespace HallOfFame.Utils;

/// <summary>
/// The mod's error messages and warnings, in the game's plain message dialog rather than its error
/// dialog, which adds a Quit Game action to any dialog offering neither Quit nor Rename.
/// The message dialog shares the one answer callback the game keeps for confirmations, so an error
/// shown over an awaited confirmation takes that callback, and gives it back once it closes.
/// The game drops a dialog nothing listens for, as at boot before the menu mounts, so one shown
/// then waits for <see cref="ShowHeld"/>, and one shown while others wait queues behind them.
/// </summary>
internal static class ErrorMessageDialog {
  private static readonly Queue<MessageDialog> Held = new();

  internal static void Show(LocalizedString message, string title = "HallOfFame.Common.OOPS") =>
    ErrorMessageDialog.Show(GameManager.instance.userInterface.appBindings, message, title);

  internal static void Show(AppBindings appBindings, LocalizedString message, string title) {
    var dialog = new MessageDialog(
      LocalizedString.Id(title),
      message,
      LocalizedString.IdWithFallback("Common.CLOSE", "Close")
    );

    if (ErrorMessageDialog.Held.Count is 0 && DialogCallbackAccessor.IsListening(appBindings)) {
      ErrorMessageDialog.ShowNow(appBindings, dialog);
    }
    else {
      ErrorMessageDialog.Held.Enqueue(dialog);
    }
  }

  /// <summary>
  /// Shows the dialogs held while nothing listened, once something does.
  /// </summary>
  internal static void ShowHeld(AppBindings appBindings) {
    while (ErrorMessageDialog.Held.Count > 0 && DialogCallbackAccessor.IsListening(appBindings)) {
      ErrorMessageDialog.ShowNow(appBindings, ErrorMessageDialog.Held.Dequeue());
    }
  }

  private static void ShowNow(AppBindings appBindings, MessageDialog dialog) {
    // A callback still set belongs to a dialog the game shows under this one, which answers once
    // the player closes this one: the error hands it back then.
    var pending = DialogCallbackAccessor.Get(appBindings);

    appBindings.ShowMessageDialog(dialog, _ => DialogCallbackAccessor.Set(appBindings, pending));
  }
}
