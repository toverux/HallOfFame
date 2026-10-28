using Game.UI.Localization;
using HallOfFame.Utils;

namespace HallOfFame.Reflection;

/// <summary>
/// Production <see cref="IParadoxConnection"/> adapter, reading the account ID through
/// <see cref="PdxSdkPlatformProxy.AccountUserId"/> and showing the no-connection warning through
/// <see cref="ErrorMessageDialog"/>.
/// </summary>
internal sealed class ParadoxConnection : IParadoxConnection {
  public string? ReadAccountId() => PdxSdkPlatformProxy.AccountUserId;

  public void ShowNoParadoxConnectionWarning() =>
    ErrorMessageDialog.Show(
      LocalizedString.Id("HallOfFame.Settings.PARADOX_LOGIN_DIALOG[Message]"),
      "HallOfFame.Settings.PARADOX_LOGIN_DIALOG[Title]"
    );
}
