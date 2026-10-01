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
/// onto the UI, drives the like/save/report flows, owns their error policy, and decides when a
/// fresh screenshot is owed and when to serve it.
/// <para>
/// It constructs and owns the deep leaves it sequences (<see cref="ScreenshotCarousel"/>,
/// <see cref="NavigationState"/>, <see cref="ScreenshotLiker"/>,
/// <see cref="ScreenshotViewRecorder"/>, <see cref="ScreenshotExporter"/>), and reaches the engine
/// only through the narrow seams it is handed:
/// <see cref="ISlideshowPresentationSink"/> (value pushes and dialogs),
/// <see cref="ISlideshowSettings"/> (resolution and save directory),
/// <see cref="IHallOfFameApi"/>, and <see cref="IModLog"/>.
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
  /// The conductor's own memory of a load that is owed: nothing has been published yet, the
  /// published screenshot predates the current main-menu session, or the user just reported it.
  /// Owning that memory here is what makes the load survive a UI that is not mounted yet, a
  /// navigation lock held by an in-flight load, and a failed fetch.
  /// Cleared in <see cref="ApplyStep"/> once a screenshot is actually on screen, never when the
  /// load is requested, so a request turned away on the navigation lock is still owed when the
  /// lock frees.
  /// </summary>
  private bool isRefreshPending = true;

  /// <summary>
  /// Whether the slideshow UI is mounted and able to display a screenshot, reported by the UI
  /// through <see cref="OnSlideshowMounted"/> and cleared whenever the game leaves the main menu,
  /// which tears the menu UI down.
  /// It gates <see cref="ServeRefresh"/>, so an owed load is never spent on a request and a view
  /// count while there is nothing on screen to show the result.
  /// </summary>
  private bool isSlideshowMounted;

  /// <param name="api">Server API used by the leaves this conductor drives.</param>
  /// <param name="log">
  /// Mod logger; the conductor logs through it and never renders off-engine.
  /// </param>
  /// <param name="settings">Seam over the resolution and save-directory settings.</param>
  /// <param name="sink">
  /// Outbound-effects seam onto which the conductor pushes UI and dialogs.
  /// </param>
  internal SlideshowConductor(
    IHallOfFameApi api,
    IModLog log,
    ISlideshowSettings settings,
    ISlideshowPresentationSink sink
  ) {
    this.api = api;
    this.log = log;
    this.settings = settings;
    this.sink = sink;

    // The conductor constructs its own leaves and injects only the true boundaries, so tests
    // exercise the real leaves wired to fakes.
    this.carousel = new ScreenshotCarousel(api);

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
      step = this.carousel.Previous();
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
  /// Reports the current screenshot after the user confirms, then shows a success dialog and moves
  /// off the reported screenshot, or surfaces the failure.
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

      // The reported screenshot must not stay on screen. The UI is necessarily mounted here (the
      // user just acted on it), so this is served right away, or once the prefetch holding the
      // navigation lock releases it.
      this.isRefreshPending = true;

      await this.Next();
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
  /// Forwards a game-mode change: mirrors the main-menu flag onto the UI, and on the way out of the
  /// menu forgets the mount and owes the next menu session a fresh screenshot.
  /// The debt is incurred on the way out rather than on the way back so that it is incurred exactly
  /// once, leaving <see cref="OnSlideshowMounted"/> as the only thing that can settle it.
  /// That also lands the refresh when the menu UI mounts, rather than whenever the engine gets
  /// around to announcing the return.
  /// </summary>
  internal void OnGameModeChanged(GameMode mode) {
    // The keep-alive set narrows to the current image only while playing, so the UI needs to know
    // which side of the menu boundary we are on. True exactly for the main menu, never for the
    // in-game pause menu (which stays GameMode.Game).
    this.sink.SetInMainMenu(mode is GameMode.MainMenu);

    if (mode is GameMode.MainMenu) {
      return;
    }

    this.isSlideshowMounted = false;
    this.isRefreshPending = true;
  }

  /// <summary>
  /// Takes the slideshow UI's report that it is mounted and able to display a screenshot, and
  /// serves the refresh it is owed, if any.
  /// It is the seam that keeps the first load from happening before anything can show it, and the
  /// only thing the UI has to say about when a screenshot is loaded.
  /// Idempotent by design: it is the UI's mount that is reported, not an event, so a remount (a
  /// menu sub-screen round trip, a development UI reload) holds the screenshot already on screen
  /// rather than loading a new one.
  /// Designed never to throw, so the shell can fire-and-forget it.
  /// </summary>
  internal Task OnSlideshowMounted() {
    this.isSlideshowMounted = true;

    return this.ServeRefresh();
  }

  /// <summary>
  /// Classifies an exception as a network error (vs. an unexpected, recoverable one), driving the
  /// display-load and save error policies.
  /// </summary>
  internal static bool IsNetworkError(Exception ex) => ex is HttpException;

  /// <summary>
  /// Loads a screenshot when one is owed and the slideshow is mounted to show it, and does nothing
  /// otherwise.
  /// Gating on the mount here rather than at each call site is what keeps an owed load from being
  /// spent on a request and a view count nobody sees: the flag outlives the menu session.
  /// </summary>
  private Task ServeRefresh() =>
    this.isRefreshPending && this.isSlideshowMounted ? this.Next() : Task.CompletedTask;

  /// <summary>
  /// Mirrors a successful <see cref="NavigationStep"/> onto the UI and enacts the side effects
  /// around it: it publishes the screenshot, clears the owed load, settles the navigation lock,
  /// records the view, prefetches the next image when the step calls for it, and serves any load
  /// the prefetch's lock turned away.
  /// The screenshot is published before the prefetch is awaited, so the display stays immediate
  /// while the lock is held throughout the prefetch.
  /// This is the single apply path shared by next, previous, and (in debug) load-by-id.
  /// </summary>
  private async Task ApplyStep(NavigationStep step) {
    // The screenshot is now displayed, so clear any error left over from a prior failed load.
    this.sink.PublishLoadError(null);
    this.sink.PublishScreenshot(step.Current);
    this.PublishNeighbors();

    // A load landing after the user left the menu reaches no screen, so it settles nothing: the
    // debt outlives it, and the view stays unspent rather than marking a screenshot nobody saw as
    // shown, which the server's weighting would then hide from other players' rotations.
    // Every apply path that does reach a screen records the view, scrollback re-displays included:
    // the recorder owns the at-most-once dedupe, so the conductor does not pre-filter here.
    if (this.isSlideshowMounted) {
      this.isRefreshPending = false;

      _ = this.viewRecorder.RecordView(step.Current.Id);
    }

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

    if (step.ShouldPreloadAhead) {
      // We are viewing the front of the window: prepare the next screenshot in the background,
      // which keeps the navigation lock held until the prefetch settles.
      await this.PreloadAhead();

      // That held lock is what turns an owed load away, so serve one now it is free. The clear
      // above runs first, so a chain here only continues while loads keep being owed.
      await this.ServeRefresh();
    }
  }

  /// <summary>
  /// Background look-ahead prefetch, designed never to throw.
  /// Releases the navigation lock in its finally, so the lock stays held throughout the prefetch.
  /// </summary>
  private async Task PreloadAhead() {
    try {
      await this.carousel.PreloadAhead();

      // The look-ahead just landed, so it is now the current screenshot's `next` neighbor:
      // republish so the UI can keep it resident.
      this.PublishNeighbors();
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
  /// Publishes the current screenshot's window neighbors (previous and look-ahead) onto the UI, the
  /// single source of truth for the keep-alive set and the Previous-button state.
  /// </summary>
  private void PublishNeighbors() =>
    this.sink.PublishNeighbors(this.carousel.PreviousNeighbor, this.carousel.NextNeighbor);

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
