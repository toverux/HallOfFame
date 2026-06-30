using System;
using System.Globalization;
using Colossal.Serialization.Entities;
using Game;
using Game.SceneFlow;
using Game.UI;
using Game.UI.Localization;
using Game.UI.Menu;
using HallOfFame.Domain;
using HallOfFame.Services;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

/// <summary>
/// System in charge of retrieving the creator's stats and displaying a standard notification with
/// those stats when the mod starts.
/// </summary>
internal sealed partial class StatsNotificationSystem : GameSystemBase {
  private NotificationUISystem? notificationUISystem;

  private StatsNotifier statsNotifier = null!;

  private string thousandsSeparator = string.Empty;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      this.Enabled = false;

      this.notificationUISystem =
        this.World.GetOrCreateSystemManaged<NotificationUISystem>();

      this.thousandsSeparator = "Common.THOUSANDS_SEPARATOR".Translate(
        NumberFormatInfo.InvariantInfo.NumberGroupSeparator
      );

      // The notifier owns the fetch/threshold/error lifecycle; this system keeps owning the
      // engine-bound notification it builds through the callback.
      this.statsNotifier = new StatsNotifier(
        Mod.Api,
        Mod.Log,
        this.ShowStatsNotification
      );

      // If the mod loaded *after* the main menu has already loaded, show the notification.
      if (GameManager.instance.gameMode is GameMode.MainMenu) {
        _ = this.statsNotifier.ShowIfNotable();
      }
    }
    catch (Exception ex) {
      Mod.Log.ErrorSilent(ex);
    }
  }

  protected override void OnGamePreload(Purpose purpose, GameMode mode) {
    base.OnGamePreload(purpose, mode);

    if (mode is not GameMode.MainMenu) {
      this.notificationUISystem?.RemoveNotification("HallOfFame.CreatorStats");
    }
  }

  protected override void OnGameLoadingComplete(
    Purpose purpose,
    GameMode mode
  ) {
    base.OnGameLoadingComplete(purpose, mode);

    if (mode is GameMode.MainMenu) {
      _ = this.statsNotifier.ShowIfNotable();
    }
  }

  protected override void OnUpdate() {
    // no-op
  }

  /// <summary>
  /// Builds and shows the creator-stats notification for the given notable stats, wiring its click
  /// to open the detailed stats dialog.
  /// This is the engine-bound presentation the <see cref="StatsNotifier"/> drives through its
  /// callback.
  /// </summary>
  private void ShowStatsNotification(CreatorStats stats) {
    this.notificationUISystem!.AddOrUpdateNotification(
      "HallOfFame.CreatorStats",
      "Menu.NOTIFICATION_TITLE[HallOfFame.CreatorStats]",
      LocalizedString.IdWithArgs(
        "Menu.NOTIFICATION_DESCRIPTION[HallOfFame.CreatorStats]",
        ("SCREENSHOTS_COUNT", this.LocalizeNumber(stats.ScreenshotsCount)),
        ("VIEWS_COUNT", this.LocalizeNumber(stats.ViewsCount)),
        ("LIKES_COUNT", this.LocalizeNumber(stats.LikesCount))
      ),
      "coui://ui-mods/images/stats-notification.svg",
      onClicked: () => {
        this.ShowStatsDialog(stats);

        this.notificationUISystem!.RemoveNotification("HallOfFame.CreatorStats");
      }
    );
  }

  private void ShowStatsDialog(CreatorStats stats) {
    var successDialog = new MessageDialog(
      LocalizedString.Id("HallOfFame.Systems.StatsNotification.STATS_DIALOG[Title]"),
      LocalizedString.IdWithArgs(
        "HallOfFame.Systems.StatsNotification.STATS_DIALOG[Message]",
        ("SCREENSHOTS_COUNT", this.LocalizeNumber(stats.ScreenshotsCount)),
        ("VIEWS_COUNT", this.LocalizeNumber(stats.ViewsCount)),
        ("UNIQUE_VIEWS_COUNT", this.LocalizeNumber(stats.UniqueViewsCount)),
        ("LIKES_COUNT", this.LocalizeNumber(stats.LikesCount)),
        ("TOTAL_CREATORS_COUNT", this.LocalizeNumber(stats.AllCreatorsCount)),
        ("TOTAL_SCREENSHOTS_COUNT", this.LocalizeNumber(stats.AllScreenshotsCount)),
        ("TOTAL_VIEWS_COUNT", this.LocalizeNumber(stats.AllViewsCount))
      ),
      LocalizedString.IdWithFallback("Common.CLOSE", "Close")
    );

    GameManager.instance.userInterface.appBindings.ShowMessageDialog(successDialog, _ => { });
  }

  private LocalizedString LocalizeNumber(int number) {
    var numberStr = number
      .ToString("N0", CultureInfo.InvariantCulture)
      .Replace(
        NumberFormatInfo.InvariantInfo.NumberGroupSeparator,
        this.thousandsSeparator
      );

    return LocalizedString.Value(numberStr);
  }
}
