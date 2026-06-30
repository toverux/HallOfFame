using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;

namespace HallOfFame.Services;

/// <summary>
/// The decision produced by a successful carousel navigation step: which screenshot to display,
/// plus the look-ahead decision derived from where the cursor landed.
/// It carries data only; the driving system enacts the side effects (UI bindings, look-ahead
/// prefetch), keeping the carousel free of engine concerns.
/// </summary>
/// <param name="Current">
/// The screenshot to display; never null after a successful step.
/// </param>
/// <param name="ShouldPreloadAhead">
/// Whether the next look-ahead screenshot should be prefetched, true exactly when the cursor landed
/// at the front of the window (<see cref="ScreenshotCarousel.IsAtEnd"/>).
/// </param>
internal readonly record struct NavigationStep(
  Screenshot Current,
  bool ShouldPreloadAhead
);

/// <summary>
/// A cursor over a sliding window of community screenshots, driving the main-menu slideshow.
/// It is infinite forward (each step past the end fetches a fresh random screenshot), keeps bounded
/// scrollback (trimmed to <see cref="MaxWindowSize"/>), and look-ahead-prefetches the next image so
/// it can be displayed instantly.
/// It owns the loading itself (taking <see cref="IHallOfFameApi"/>, <see cref="IImagePreloader"/>,
/// and a resolution getter), which is what makes the dedupe loop, the look-ahead, and the
/// trim-testable off-engine.
/// It propagates errors and never swallows them: it touches no UI bindings and does no logging, so
/// the driving system stays the single owner of error policy.
/// </summary>
internal sealed class ScreenshotCarousel(
  IHallOfFameApi api,
  IImagePreloader preloader,
  Func<string> getResolution
) {
  /// <summary>
  /// Maximum number of screenshots kept in the window; older ones are trimmed off the front as new
  /// ones are prefetched, so the scrollback stays bounded.
  /// </summary>
  private const int MaxWindowSize = 20;

  private readonly List<Screenshot> screenshots = [];

  /// <summary>
  /// The screenshot currently pointed at by the cursor, or <c>null</c> before the first load.
  /// </summary>
  internal Screenshot? Current =>
    this.CurrentIndex >= 0 && this.CurrentIndex < this.Count
      ? this.screenshots[this.CurrentIndex]
      : null;

  /// <summary>
  /// Whether there is a screenshot before the current one to scroll back to.
  /// </summary>
  internal bool HasPrevious => this.CurrentIndex > 0;

  /// <summary>
  /// Whether the cursor is at (or past) the front of the window, i.e., there is no already-loaded
  /// look-ahead screenshot to move onto.
  /// </summary>
  internal bool IsAtEnd => this.CurrentIndex >= this.Count - 1;

  /// <summary>
  /// Index of the current screenshot in the window, <c>-1</c> before the first load.
  /// </summary>
  internal int CurrentIndex { get; private set; } = -1;

  /// <summary>
  /// Number of screenshots currently in the window.
  /// </summary>
  internal int Count => this.screenshots.Count;

  /// <summary>
  /// Moves the cursor forward by one screenshot and returns the resulting
  /// <see cref="NavigationStep"/>.
  /// If a look-ahead screenshot is already loaded, the cursor just moves onto it (its image is
  /// already preloaded); otherwise a fresh random screenshot is fetched, its image preloaded, and
  /// it is appended to the window before advancing.
  /// On error the window is left untouched, so <see cref="Current"/> does not change and no step is
  /// produced.
  /// </summary>
  internal async Task<NavigationStep> Next() {
    // A look-ahead screenshot is already in the window: just move the cursor onto it.
    if (this.CurrentIndex < this.Count - 1) {
      this.CurrentIndex++;

      return this.ForwardStep();
    }

    // We are at the front of the window: fetch a fresh screenshot, preload its image, append, and
    // advance. Mutation happens only after a successful load, so a failure leaves the cursor put.
    var screenshot = await this.LoadRandom();

    this.screenshots.Add(screenshot);
    this.CurrentIndex++;

    return this.ForwardStep();
  }

  /// <summary>
  /// Moves the cursor back by one screenshot, re-preloads its image (these images are not kept long
  /// in cohtml's cache, so they must be preloaded again on scrollback), and returns the resulting
  /// <see cref="NavigationStep"/>.
  /// </summary>
  /// <exception cref="InvalidOperationException">
  /// When already at the first screenshot; the caller is expected to guard with
  /// <see cref="HasPrevious"/>.
  /// </exception>
  internal async Task<NavigationStep> Previous() {
    if (!this.HasPrevious) {
      throw new InvalidOperationException(
        "Cannot move to the previous screenshot: already at the first one."
      );
    }

    // The cursor is moved before the preload, so on a preload error it stays put on the previous
    // screenshot, matching the pre-existing behavior.
    this.CurrentIndex--;

    await this.Preload(this.screenshots[this.CurrentIndex]);

    // Scrolling back always lands on an already-seen screenshot with look-ahead still ahead of it:
    // there is nothing to prefetch.
    // Hence, the degenerate step, regardless of the cursor position.
    return new NavigationStep(this.Current!, ShouldPreloadAhead: false);
  }

  /// <summary>
  /// Fetches a fresh random screenshot and preloads its image in the background, appending it to
  /// the window as the next look-ahead screenshot, ready for the next <see cref="Next"/>.
  /// Intended to be called only when <see cref="IsAtEnd"/>, so the trim below keeps the cursor on
  /// the same screenshot.
  /// </summary>
  internal async Task PreloadAhead() {
    // Guards against an infinite loop when the database holds only a handful of screenshots and the
    // weighted-random endpoint keeps returning the one already displayed (happens in development).
    #if DEBUG
    var iterations = 0;
    #endif

    Screenshot next;

    // Refetch until we get a screenshot different from the one currently displayed, so the
    // slideshow never shows the same screenshot twice in a row. This is cheaper here than
    // server-side, and only bites in development with very few screenshots.
    do {
      next = await this.LoadRandom();
    }
    while (
      #if DEBUG
      iterations++ < ScreenshotCarousel.MaxWindowSize &&
      #endif
      next.Id == this.Current?.Id
    );

    this.screenshots.Add(next);

    // Trim the oldest screenshot off the front when the window grows too large, adjusting the
    // cursor so it keeps pointing at the same screenshot.
    if (this.Count > ScreenshotCarousel.MaxWindowSize) {
      this.screenshots.RemoveAt(0);
      this.CurrentIndex--;
    }
  }

  /// <summary>
  /// Replaces the current screenshot in place, without moving the cursor.
  /// Used for the optimistic like update (and its revert), where the same screenshot is swapped for
  /// a copy with an updated like count.
  /// </summary>
  /// <exception cref="InvalidOperationException">
  /// When there is no current screenshot.
  /// </exception>
  internal void ReplaceCurrent(Screenshot screenshot) {
    if (this.Current is null) {
      throw new InvalidOperationException("Cannot replace the current screenshot: there is none.");
    }

    this.screenshots[this.CurrentIndex] = screenshot;
  }

  #if DEBUG
  /// <summary>
  /// Debug-only: loads a specific screenshot by its ID, preloads its image, appends it to the
  /// window, and advances the cursor onto it so <see cref="Current"/> stays consistent, returning
  /// the resulting <see cref="NavigationStep"/>.
  /// It lands at the front of the window, so the step prefetches ahead like any other forward move.
  /// </summary>
  internal async Task<NavigationStep> LoadById(string id) {
    var screenshot = await api.GetScreenshot(id);

    await this.Preload(screenshot);

    this.screenshots.Add(screenshot);
    this.CurrentIndex = this.Count - 1;

    return this.ForwardStep();
  }
  #endif

  /// <summary>
  /// Builds the <see cref="NavigationStep"/> for the screenshot the cursor has just moved forward
  /// onto.
  /// Landing at the front of the window (<see cref="IsAtEnd"/>) is what triggers the look-ahead
  /// prefetch; moving onto an already-loaded look-ahead screenshot does not.
  /// </summary>
  private NavigationStep ForwardStep() =>
    new(this.Current!, ShouldPreloadAhead: this.IsAtEnd);

  /// <summary>
  /// Fetches a fresh random screenshot from the server and preloads its image.
  /// </summary>
  private async Task<Screenshot> LoadRandom() {
    var screenshot = await api.GetRandomScreenshotWeighted();

    await this.Preload(screenshot);

    return screenshot;
  }

  /// <summary>
  /// Preloads the image for the given screenshot at the currently configured resolution.
  /// </summary>
  private Task Preload(Screenshot screenshot) =>
    preloader.Preload(this.SelectImageUrl(screenshot));

  /// <summary>
  /// Picks the image URL for the configured screenshot resolution.
  /// </summary>
  /// <remarks>
  /// This resolution-to-URL mapping is deliberately duplicated on the front end
  /// (<c>deriveImageUri</c>): C# resolves it here to choose which variant to preload, and the UI
  /// resolves it again to choose which to display.
  /// Collapsing the two into a single C#-resolved URL sent across the binding was considered and
  /// dropped: the UI re-derives live from the reactive resolution setting, so changing it updates
  /// the on-screen image immediately. Making C# the sole resolver would instead force it to
  /// re-preload and republish on every settings change to stay flash-free, more complexity than
  /// the deduplication is worth.
  /// Both sides must therefore agree on the mapping for every supported resolution.
  /// </remarks>
  /// <exception cref="InvalidOperationException">
  /// When the configured resolution is not a known value.
  /// </exception>
  private string SelectImageUrl(Screenshot screenshot) =>
    getResolution() switch {
      "fhd" => screenshot.ImageUrlFHD,
      "4k" => screenshot.ImageUrl4K,
      var resolution => throw new InvalidOperationException(
        $"Unknown screenshot resolution: {resolution}."
      )
    };
}
