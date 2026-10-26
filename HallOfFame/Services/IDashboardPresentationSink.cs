using Game.UI.Localization;

namespace HallOfFame.Services;

/// <summary>
/// Outbound-effects seam through which <see cref="DashboardService"/> pushes
/// what the Creator Dashboard shows,
/// keeping the service free of engine-bound binding types so it runs off-engine under test.
/// The production implementation is <c>DashboardUISystem</c>; tests inject an in-memory fake.
/// </summary>
internal interface IDashboardPresentationSink {
  void Publish(DashboardState state);

  void PublishDetail(DashboardDetailState detail);

  /// <summary>
  /// Shows a failed edit's message in the mod's error dialog.
  /// </summary>
  void ShowError(LocalizedString message);
}
