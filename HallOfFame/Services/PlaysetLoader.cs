using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Http;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Loads the playsets of the screenshots whose Playset tab the viewer opens, and publishes where
/// the last one asked for stands.
/// A loaded playset is kept for the session, so reopening the tab or the window answers at once; a
/// failed one is not, so a retry asks the server again.
/// </summary>
internal sealed class PlaysetLoader(
  IHallOfFameApi api,
  IModLog log,
  Action<PlaysetState> publish
) {
  private readonly Dictionary<string, IReadOnlyList<Domain.Mod>> loadedPlaysets = new();

  // The screenshots whose request is in flight, which a second load leaves to that request.
  private readonly HashSet<string> loadingScreenshotIds = [];

  // The screenshot of the last load asked for, the only one whose state is published.
  private string? requestedScreenshotId;

  /// <summary>
  /// Publishes the playset of <paramref name="screenshotId"/>, through a loading state unless it is
  /// already in memory.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal async Task Load(string screenshotId) {
    this.requestedScreenshotId = screenshotId;

    if (this.loadedPlaysets.TryGetValue(screenshotId, out var loaded)) {
      publish(
        new PlaysetState {
          ScreenshotId = screenshotId,
          Status = PlaysetStatus.Loaded,
          Mods = loaded
        }
      );

      return;
    }

    publish(
      new PlaysetState {
        ScreenshotId = screenshotId,
        Status = PlaysetStatus.Loading,
        Mods = []
      }
    );

    if (!this.loadingScreenshotIds.Add(screenshotId)) {
      return;
    }

    try {
      var mods = await api.GetPlayset(screenshotId);

      this.loadedPlaysets[screenshotId] = mods;

      this.PublishIfRequested(
        new PlaysetState {
          ScreenshotId = screenshotId,
          Status = PlaysetStatus.Loaded,
          Mods = mods
        }
      );
    }
    catch (Exception ex) {
      log.ErrorSilent(ex);

      this.PublishIfRequested(
        new PlaysetState {
          ScreenshotId = screenshotId,
          Status = PlaysetStatus.Failed,
          Mods = []
        }
      );
    }
    finally {
      this.loadingScreenshotIds.Remove(screenshotId);
    }
  }

  private void PublishIfRequested(PlaysetState state) {
    if (state.ScreenshotId == this.requestedScreenshotId) {
      publish(state);
    }
  }
}
