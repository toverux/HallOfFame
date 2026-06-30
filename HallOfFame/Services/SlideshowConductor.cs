using System;
using System.Threading.Tasks;
using Game;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Utils;

namespace HallOfFame.Services;

/// <summary>
/// Owns the main-menu slideshow orchestration lifted out of <c>SlideshowUISystem</c>: it sequences
/// the navigation lock (begin, settle or abort, background prefetch), applies each navigation step
/// onto the UI, drives the like/save/report flows, owns their error policy, and decides when to
/// refresh on return to the main menu.
/// <para>
/// It constructs and owns the deep leaves it sequences (<see cref="ScreenshotCarousel"/>,
/// <see cref="NavigationState"/>, <see cref="ScreenshotLiker"/>, <see cref="ScreenshotViewRecorder"/>,
/// <see cref="ScreenshotExporter"/>) and reaches the engine only through the narrow
/// <see cref="ISlideshowPresentationSink"/> (value pushes and dialogs),
/// <see cref="ISlideshowSettings"/> (resolution and save directory),
/// <see cref="IHallOfFameApi"/>, and <see cref="IModLog"/> seams.
/// Carrying no engine-bound binding or dialog types, it constructs and runs off-engine under test,
/// where the sequencing bugs finally have a test surface.
/// </para>
/// <para>
/// The <c>SlideshowUISystem</c> shell is reduced to the production adapter: it registers the engine
/// bindings, forwards engine events to this conductor, and implements
/// <see cref="ISlideshowPresentationSink"/>.
/// Exactly the <see cref="CreatorIdentity"/> to <see cref="Settings"/> relationship.
/// </para>
/// </summary>
internal sealed class SlideshowConductor {
  private readonly IHallOfFameApi api;

  private readonly IModLog log;

  private readonly ISlideshowSettings settings;

  private readonly ISlideshowPresentationSink sink;

  private readonly ScreenshotCarousel carousel;

  private readonly NavigationState navigation;

  private readonly ScreenshotLiker liker;

  private readonly ScreenshotViewRecorder viewRecorder;

  private readonly ScreenshotExporter exporter;

  /// <summary>
  /// Whether a screenshot is currently being exported to disk, owned here as the save flow's
  /// reentrancy guard and mirrored onto the UI through
  /// <see cref="ISlideshowPresentationSink.SetSaving"/>.
  /// </summary>
  private bool isSaving;

  /// <summary>
  /// The previous game mode, used to refresh the screenshot when the user returns to the main menu.
  /// It is initialized with <see cref="GameMode.MainMenu"/> and not the default value, it is
  /// intentional: it prevents a refresh when the game boots and mods are initialized before the
  /// first game mode is set.
  /// </summary>
  private GameMode previousGameMode = GameMode.MainMenu;

  /// <param name="api">Server API used by the leaves this conductor drives.</param>
  /// <param name="preloader">Image preloader the carousel loads images through.</param>
  /// <param name="log">
  /// Mod logger; the conductor logs through it and never renders off-engine.
  /// </param>
  /// <param name="settings">Seam over the resolution and save-directory settings.</param>
  /// <param name="sink">
  /// Outbound-effects seam onto which the conductor pushes UI and dialogs.
  /// </param>
  internal SlideshowConductor(
    IHallOfFameApi api,
    IImagePreloader preloader,
    IModLog log,
    ISlideshowSettings settings,
    ISlideshowPresentationSink sink
  ) {
    this.api = api;
    this.log = log;
    this.settings = settings;
    this.sink = sink;

    // The conductor constructs its own leaves and injects only the true boundaries, so tests
    // exercise the real leaves wired to fakes. The carousel reads the resolution lazily, per load.
    this.carousel = new ScreenshotCarousel(api, preloader, () => settings.ScreenshotResolution);

    this.navigation = new NavigationState();

    // The Liker reports back through two narrow callbacks; the conductor adapts them to the sink,
    // translating the HTTP failure into a user-friendly message on the way to the error dialog.
    this.liker = new ScreenshotLiker(
      this.carousel,
      api,
      log,
      sink.PublishScreenshot,
      ex => sink.ShowError(ex.GetUserFriendlyMessage())
    );

    this.viewRecorder = new ScreenshotViewRecorder(api, log);

    this.exporter = new ScreenshotExporter(api);
  }

  /// <summary>
  /// Advances to the next screenshot, loading a fresh one when there is no look-ahead in stock,
  /// then prefetching the following one in the background. (Awaited internally, after the
  /// screenshot is published, so the display stays immediate while the lock is held.)
  /// Designed never to throw, so the shell can fire-and-forget it.
  /// </summary>
  internal async Task Next() {
    if (!this.navigation.CanAdvance) {
      return;
    }

    this.navigation.Begin();
    this.sink.SetCanAdvance(this.navigation.CanAdvance);

    NavigationStep step;

    try {
      step = await this.carousel.Next();
    }
    catch (Exception ex) {
      this.AbortNavigation(ex);

      return;
    }

    await this.ApplyStep(step);
  }

  /// <summary>
  /// Switches the current screenshot to the previous one, re-preloading its image.
  /// Designed never to throw, so the shell can fire-and-forget it.
  /// </summary>
  internal async Task Previous() {
    if (!this.navigation.CanAdvance) {
      return;
    }

    // Soft guard kept here: the carousel would throw at the first screenshot, but here this is an
    // expected no-op rather than an error.
    // Checked before acquiring the lock so there is no acquire-then-release.
    if (!this.carousel.HasPrevious) {
      this.log.ErrorSilent(
        $"{nameof(SlideshowConductor)}: {nameof(this.Previous)}: " +
        $"Cannot go back, already at the first screenshot."
      );

      return;
    }

    this.navigation.Begin();
    this.sink.SetCanAdvance(this.navigation.CanAdvance);

    NavigationStep step;

    try {
      step = await this.carousel.Previous();
    }
    catch (Exception ex) {
      this.AbortNavigation(ex);

      return;
    }

    await this.ApplyStep(step);
  }

  /// <summary>
  /// Toggles the liked status of the current screenshot, delegating to the
  /// <see cref="ScreenshotLiker"/> which applies an optimistic UI update and serializes the network
  /// sync.
  /// Designed never to throw, so the shell can fire-and-forget it.
  /// </summary>
  internal Task Like() =>
    // Liking uses CanLike, broader than the CanAdvance guard on next/previous: it acts on the
    // already-settled current screenshot, so it is blocked only mid-navigation, not during the
    // background prefetch that follows (see NavigationState.CanLike).
    !this.navigation.CanLike ? Task.CompletedTask : this.liker.Toggle();

  /// <summary>
  /// Saves the current screenshot's 4K image to disk, to the path specified in the mod settings.
  /// Owns the saving indicator, the reentrancy guard, and the network-vs.-recoverable error policy.
  /// Designed never to throw, so the shell can fire-and-forget it.
  /// </summary>
  internal async Task Save() {
    var screenshot = this.carousel.Current;

    if (this.isSaving || screenshot is null) {
      return;
    }

    try {
      this.isSaving = true;
      this.sink.SetSaving(true);

      var filePath = await this.exporter.Export(screenshot, this.settings.SaveDirectory);

      this.log.Info($"{nameof(SlideshowConductor)}: Saved {screenshot} image to {filePath}.");
    }
    catch (Exception ex) when (SlideshowConductor.IsNetworkError(ex)) {
      this.log.Error(ex.GetUserFriendlyMessage());
    }
    catch (Exception ex) {
      this.log.ErrorRecoverable(ex);
    }
    finally {
      this.isSaving = false;
      this.sink.SetSaving(false);
    }
  }

  /// <summary>
  /// Reports the current screenshot after the user confirms, then shows a success dialog and
  /// requests a refresh, or surfaces the failure.
  /// A missing current screenshot is a silent no-op.
  /// Designed never to throw, so the shell can fire-and-forget it.
  /// </summary>
  internal async Task Report() {
    var screenshot = this.carousel.Current;

    if (screenshot is null) {
      return;
    }

    if (!await this.sink.ConfirmReport(screenshot)) {
      return;
    }

    try {
      await this.api.ReportScreenshot(screenshot.Id);

      this.sink.ShowReportSuccess();
      this.sink.RequestRefresh();
    }
    catch (HttpException ex) {
      this.sink.ShowError(ex.GetUserFriendlyMessage());
    }
    catch (Exception ex) {
      this.log.ErrorRecoverable(ex);
    }
  }

  #if DEBUG
  /// <summary>
  /// Debug/development entry point to load a screenshot by its ID.
  /// It appends to and advances the carousel like any other load, so the displayed screenshot stays
  /// consistent with the carousel's cursor.
  /// Designed never to throw, so the shell can fire-and-forget it.
  /// </summary>
  internal async Task LoadById(string screenshotId) {
    this.navigation.Begin();
    this.sink.SetCanAdvance(this.navigation.CanAdvance);

    NavigationStep step;

    try {
      step = await this.carousel.LoadById(screenshotId);
    }
    catch (Exception ex) {
      this.AbortNavigation(ex);

      return;
    }

    await this.ApplyStep(step);
  }
  #endif

  /// <summary>
  /// Forwards a game-mode change: refreshes the slideshow when the user returns to the main menu
  /// from another mode, then advances the previous-mode baseline.
  /// </summary>
  internal void OnGameModeChanged(GameMode mode) {
    if (SlideshowConductor.ShouldRefreshOnReturnToMenu(this.previousGameMode, mode)) {
      this.sink.RequestRefresh();
    }

    this.previousGameMode = mode;
  }

  /// <summary>
  /// Whether the carousel should refresh on a game-mode change: only when returning to the main
  /// menu from another mode, never on boot (the baseline starts at <see cref="GameMode.MainMenu"/>)
  /// or when entering a game.
  /// </summary>
  internal static bool ShouldRefreshOnReturnToMenu(GameMode previousMode, GameMode currentMode) =>
    currentMode is GameMode.MainMenu && previousMode is not GameMode.MainMenu;

  /// <summary>
  /// Classifies an exception as a network error (vs. an unexpected, recoverable one), driving the
  /// display-load and save error policies.
  /// </summary>
  internal static bool IsNetworkError(Exception ex) =>
    ex
      is HttpException
      or ImagePreloadFailedException;

  /// <summary>
  /// Mirrors a successful <see cref="NavigationStep"/> onto the UI and enacts the side effects
  /// around it: it publishes the screenshot, settles the navigation lock, records the view, and
  /// prefetches the next image when the step calls for it.
  /// The screenshot is published before the prefetch is awaited, so the display stays immediate
  /// while the lock is held throughout the prefetch.
  /// This is the single apply path shared by next, previous, and (in debug) load-by-id.
  /// </summary>
  private async Task ApplyStep(NavigationStep step) {
    // The screenshot is now displayed, so clear any error left over from a prior failed load.
    this.sink.PublishLoadError(null);
    this.sink.PublishScreenshot(step.Current);
    this.sink.SetHasPrevious(this.carousel.HasPrevious);

    // The cursor has settled onto the new screenshot. When the step lands at the front of the
    // window, the navigation settles into the background prefetch below, which keeps the lock held;
    // otherwise (scrollback) the lock is released right away.
    // Either way, the current screenshot is settled now, and a like is safe.
    this.navigation.Settle(step.ShouldPreloadAhead);
    this.sink.SetCanAdvance(this.navigation.CanAdvance);

    this.log.Verbose(
      $"{nameof(SlideshowConductor)}: {nameof(this.ApplyStep)}: Displaying {step.Current} " +
      $"(carousel idx {this.carousel.CurrentIndex}/{this.carousel.Count - 1})."
    );

    // Every apply path records the displayed screenshot as viewed, scrollback re-displays included:
    // the recorder owns the at-most-once dedupe, so the conductor does not pre-filter here.
    _ = this.viewRecorder.RecordView(step.Current.Id);

    if (step.ShouldPreloadAhead) {
      // We are viewing the front of the window: prepare the next screenshot in the background,
      // which keeps the refresh lock held until the prefetch settles.
      await this.PreloadAhead();
    }
  }

  /// <summary>
  /// Background look-ahead prefetch, designed never to throw.
  /// Releases the refresh lock in its finally, so the lock stays held throughout the prefetch.
  /// </summary>
  private async Task PreloadAhead() {
    try {
      await this.carousel.PreloadAhead();
    }
    catch (Exception ex) {
      this.log.ErrorSilent(ex);
    }
    finally {
      this.navigation.EndPrefetch();
      this.sink.SetCanAdvance(this.navigation.CanAdvance);
    }
  }

  /// <summary>
  /// Aborts an in-flight navigation after a failed load: applies the error policy and releases the
  /// navigation lock, leaving the previously displayed screenshot in place.
  /// Callers return immediately afterward.
  /// </summary>
  private void AbortNavigation(Exception ex) {
    this.HandleDisplayLoadError(ex);
    this.navigation.Abort();
    this.sink.SetCanAdvance(this.navigation.CanAdvance);
  }

  /// <summary>
  /// Applies the error policy for a failed display-load (next/previous/load-by-id): a network error
  /// is surfaced to the user via the load-error binding, anything else is logged as recoverable.
  /// Background prefetch errors are handled separately (logged silently) by
  /// <see cref="PreloadAhead"/>.
  /// </summary>
  private void HandleDisplayLoadError(Exception ex) {
    if (SlideshowConductor.IsNetworkError(ex)) {
      this.sink.PublishLoadError(ex.GetUserFriendlyMessage());
    }
    else {
      this.log.ErrorRecoverable(ex);
    }
  }
}
