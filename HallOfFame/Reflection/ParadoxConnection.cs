using Game.UI;
using Game.UI.Localization;

namespace HallOfFame.Reflection;

/// <summary>
/// Production <see cref="IParadoxConnection"/> adapter over the reflection accessors:
/// <see cref="PdxSdkPlatformProxy.AccountUserId"/> for the account-ID read and
/// <see cref="ErrorDialogManagerAccessor"/> for the no-connection warning dialog.
/// </summary>
internal sealed class ParadoxConnection : IParadoxConnection {
  public string? ReadAccountId() => PdxSdkPlatformProxy.AccountUserId;

  public void ShowNoParadoxConnectionWarning() {
    ErrorDialogManagerAccessor.Instance?.ShowError(
      new ErrorDialog {
        severity = ErrorDialog.Severity.Warning,
        localizedTitle = LocalizedString.Id("HallOfFame.Settings.PARADOX_LOGIN_DIALOG[Title]"),
        localizedMessage = LocalizedString.Id("HallOfFame.Settings.PARADOX_LOGIN_DIALOG[Message]"),
        actions = ErrorDialog.ActionBits.Continue
      }
    );
  }
}
