using System;
using System.Collections.Generic;
using System.Globalization;
using Colossal.Serialization.Entities;
using Game;
using Game.SceneFlow;
using Game.UI;
using Game.UI.Localization;
using Game.UI.Menu;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

/// <summary>
/// System in charge of retrieving the creator's stats and displaying a standard notification with
/// those stats when the mod starts.
/// </summary>
internal sealed partial class StatsNotificationSystem : GameSystemBase {
  private NotificationUISystem? notificationUISystem;

  private bool notificationShownOrLoading;

  private string thousandsSeparator = string.Empty;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      this.Enabled = false;

      this.notificationUISystem =
        this.World.GetOrCreateSystemManaged<NotificationUISystem>();

      this.thousandsSeparator = "Common.THOUSANDS_SEPARATOR".Translate(
        fallback: NumberFormatInfo.InvariantInfo.NumberGroupSeparator);

      // If the mod loaded *after* the main menu has already loaded, show the notification.
      if (GameManager.instance.gameMode is GameMode.MainMenu) {
        this.LoadAndShowNotification();
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
    GameMode mode) {
    base.OnGameLoadingComplete(purpose, mode);

    if (mode is GameMode.MainMenu) {
      this.LoadAndShowNotification();
    }
  }

  protected override void OnUpdate() {
    // no-op
  }

  /// <summary>
  /// Load the creator stats and display a notification with the stats.
  /// The method is `async void` because it is designed to be called in a fire-and-forget manner,
  /// and it should be designed to never throw.
  /// </summary>
  private async void LoadAndShowNotification() {
    try {
      if (this.notificationShownOrLoading) {
        return;
      }

      this.notificationShownOrLoading = true;

      if (this.notificationUISystem is null) {
        Mod.Log.ErrorSilent($"{nameof(NotificationUISystem)} is null.");

        return;
      }

      var stats = await HttpQueries.GetCreatorStats();

      if (stats.FavoritesCount < 2) {
        return;
      }

      this.notificationUISystem.AddOrUpdateNotification(
        identifier: "HallOfFame.CreatorStats",
        title: "Menu.NOTIFICATION_TITLE[HallOfFame.CreatorStats]",
        text: new LocalizedString(
          "Menu.NOTIFICATION_DESCRIPTION[HallOfFame.CreatorStats]",
          "",
          new Dictionary<string, ILocElement> {
            { "SCREENSHOTS_COUNT", this.LocalizeNumber(stats.ScreenshotsCount) },
            { "VIEWS_COUNT", this.LocalizeNumber(stats.ViewsCount) },
            { "FAVORITES_COUNT", this.LocalizeNumber(stats.FavoritesCount) }
          }),
        thumbnail: "coui://ui-mods/images/stats-notification.svg",
        onClicked: () => {
          this.ShowStatsDialog(stats);

          this.notificationUISystem.RemoveNotification("HallOfFame.CreatorStats");
        });
    }
    catch (HttpException ex) {
      Mod.Log.ErrorSilent(ex);
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);
    }
  }

  private void ShowStatsDialog(CreatorStats stats) {
    var successDialog = new MessageDialog(
      LocalizedString.Id("HallOfFame.Systems.StatsNotification.STATS_DIALOG[Title]"),
      new LocalizedString(
        "HallOfFame.Systems.StatsNotification.STATS_DIALOG[Message]",
        "",
        new Dictionary<string, ILocElement> {
          { "SCREENSHOTS_COUNT", this.LocalizeNumber(stats.ScreenshotsCount) },
          { "VIEWS_COUNT", this.LocalizeNumber(stats.ViewsCount) },
          { "FAVORITES_COUNT", this.LocalizeNumber(stats.FavoritesCount) },
          { "TOTAL_CREATORS_COUNT", this.LocalizeNumber(stats.AllCreatorsCount) },
          { "TOTAL_SCREENSHOTS_COUNT", this.LocalizeNumber(stats.AllScreenshotsCount) },
          { "TOTAL_VIEWS_COUNT", this.LocalizeNumber(stats.AllViewsCount) }
        }),
      LocalizedString.IdWithFallback("Common.CLOSE", "Close"));

    GameManager.instance.userInterface.appBindings.ShowMessageDialog(successDialog, _ => { });
  }

  private LocalizedString LocalizeNumber(int number) {
    var numberStr = number
      .ToString("N0", CultureInfo.InvariantCulture)
      .Replace(
        NumberFormatInfo.InvariantInfo.NumberGroupSeparator,
        this.thousandsSeparator);

    return LocalizedString.Value(numberStr);
  }
}
