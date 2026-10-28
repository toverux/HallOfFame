using System;
using System.Reflection;
using Colossal.UI.Binding;
using Game.UI;

namespace HallOfFame.Reflection;

/// <summary>
/// The game's one dialog answer callback, <c>AppBindings.m_ConfirmationDialogCallback</c>, which
/// every confirmation and message dialog overwrites, and which the game clears before calling it,
/// and the event binding those dialogs go out through, which drops one while the UI has no
/// subscriber (read in the decompiled <c>AppBindings</c> and <c>EventBinding</c>).
/// Where a game update renamed either, reads give null, writes do nothing, and the UI counts as
/// listening.
/// </summary>
internal static class DialogCallbackAccessor {
  private static readonly FieldInfo? Field = typeof(AppBindings).GetField(
    "m_ConfirmationDialogCallback",
    BindingFlags.NonPublic | BindingFlags.Instance
  );

  private static readonly FieldInfo? BindingField = typeof(AppBindings).GetField(
    "m_ConfirmationDialogBinding",
    BindingFlags.NonPublic | BindingFlags.Instance
  );

  static DialogCallbackAccessor() {
    if (DialogCallbackAccessor.Field is null || DialogCallbackAccessor.BindingField is null) {
      Mod.Log.ErrorRecoverable(
        new Exception("Failed to find AppBindings.m_ConfirmationDialogCallback or its binding.")
      );
    }
  }

  public static void Init() {
    // Just a method to force-initialize the static constructor.
  }

  internal static Action<int>? Get(AppBindings appBindings) =>
    DialogCallbackAccessor.Field?.GetValue(appBindings) as Action<int>;

  internal static void Set(AppBindings appBindings, Action<int>? callback) =>
    DialogCallbackAccessor.Field?.SetValue(appBindings, callback);

  /// <summary>
  /// Whether the UI subscribes to the dialogs, which it does once the menu, game or editor mounts.
  /// </summary>
  internal static bool IsListening(AppBindings appBindings) =>
    DialogCallbackAccessor.BindingField?.GetValue(appBindings) is not EventBindingBase {
      active: false
    };
}
