using System;
using System.Reflection;
using System.Runtime.Serialization;
using System.Threading.Tasks;
using Colossal.UI.Binding;
using Game.UI;
using Game.UI.Localization;
using HallOfFame.Reflection;
using HallOfFame.Utils;
using Xunit;

namespace HallOfFame.Tests.Utils;

/// <summary>
/// The game's app bindings, built bare off-engine: a dialog that reaches the view fails on the
/// detached writer, after the game set its answer callback, which is how a test sees it shown.
/// </summary>
public sealed class ErrorMessageDialogTests {
  private const BindingFlags Private = BindingFlags.NonPublic | BindingFlags.Instance;

  [Fact]
  public async Task Show_OverAnAwaitedConfirmation_LetsItAnswerOnceTheErrorCloses() {
    var appBindings = ErrorMessageDialogTests.CreateAppBindings(isListening: true);
    var confirmation = new TaskCompletionSource<int>();

    // What ShowConfirmationDialogAndWait leaves behind while the player has not answered.
    DialogCallbackAccessor.Set(appBindings, confirmation.SetResult);

    ErrorMessageDialogTests.AssertShows(() => ErrorMessageDialogTests.ShowError(appBindings));

    // The game stacks its dialogs: the error closes first, then the confirmation under it answers.
    ErrorMessageDialogTests.Answer(appBindings, 0);
    ErrorMessageDialogTests.Answer(appBindings, 1);

    Assert.True(confirmation.Task.IsCompleted);
    Assert.Equal(1, await confirmation.Task);
  }

  [Fact]
  public void Show_WhileNothingListens_HoldsTheDialogUntilSomethingDoes() {
    var appBindings = ErrorMessageDialogTests.CreateAppBindings(isListening: false);

    ErrorMessageDialogTests.ShowError(appBindings);
    ErrorMessageDialog.ShowHeld(appBindings);

    ErrorMessageDialogTests.SetListening(appBindings, true);

    ErrorMessageDialogTests.AssertShows(() => ErrorMessageDialog.ShowHeld(appBindings));
    ErrorMessageDialog.ShowHeld(appBindings);
  }

  [Fact]
  public void Show_WhileDialogsWait_QueuesBehindThem() {
    var appBindings = ErrorMessageDialogTests.CreateAppBindings(isListening: false);

    ErrorMessageDialogTests.ShowError(appBindings);

    ErrorMessageDialogTests.SetListening(appBindings, true);

    ErrorMessageDialogTests.ShowError(appBindings);

    // One dialog reaches the view per call here, the detached writer failing each.
    ErrorMessageDialogTests.AssertShows(() => ErrorMessageDialog.ShowHeld(appBindings));
    ErrorMessageDialogTests.AssertShows(() => ErrorMessageDialog.ShowHeld(appBindings));
    ErrorMessageDialog.ShowHeld(appBindings);
  }

  private static void ShowError(AppBindings appBindings) =>
    ErrorMessageDialog.Show(appBindings, LocalizedString.Value("Save failed"), "OOPS");

  private static void AssertShows(Action show) {
    var ex = Assert.Throws<Exception>(show);

    Assert.Contains("not attached", ex.Message);
  }

  private static AppBindings CreateAppBindings(bool isListening) {
    var appBindings = (AppBindings) FormatterServices.GetUninitializedObject(typeof(AppBindings));

    // Built bare, as its constructor reaches the engine's logging, with a writer left detached.
    var binding =
      FormatterServices.GetUninitializedObject(typeof(EventBinding<ConfirmationDialogBase>));

    ErrorMessageDialogTests.Field(typeof(RawEventBindingBase), "<jsonWriter>k__BackingField")
      .SetValue(binding, new JsonWriter("app.confirmationDialog"));

    ErrorMessageDialogTests.Field(typeof(AppBindings), "m_ConfirmationDialogBinding")
      .SetValue(appBindings, binding);

    ErrorMessageDialogTests.SetListening(appBindings, isListening);

    return appBindings;
  }

  private static void SetListening(AppBindings appBindings, bool isListening) {
    var binding = ErrorMessageDialogTests
      .Field(typeof(AppBindings), "m_ConfirmationDialogBinding")
      .GetValue(appBindings);

    ErrorMessageDialogTests.Field(typeof(EventBindingBase), "<observerCount>k__BackingField")
      .SetValue(binding, isListening ? 1 : 0);
  }

  private static void Answer(AppBindings appBindings, int answer) {
    var method = typeof(AppBindings).GetMethod(
        "OnConfirmationDialogCallback",
        ErrorMessageDialogTests.Private
      ) ??
      throw new InvalidOperationException("Missing AppBindings.OnConfirmationDialogCallback.");

    method.Invoke(appBindings, [answer]);
  }

  private static FieldInfo Field(Type type, string name) =>
    type.GetField(name, ErrorMessageDialogTests.Private) ??
    throw new InvalidOperationException($"Missing {type.Name}.{name}.");
}
