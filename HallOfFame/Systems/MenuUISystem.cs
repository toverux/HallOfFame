using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.SceneFlow;
using Game.UI;
using Game.UI.Localization;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

/// <summary>
/// System responsible for handling the Hall of Fame UI on the game's main menu.
/// </summary>
internal sealed partial class MenuUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame.menu";

    private const string VanillaDefaultImageUri = "Media/Menu/Background2.jpg";

    private ImagePreloaderUISystem imagePreloaderUISystem = null!;

    private ValueBinding<string> defaultImageUriBinding = null!;

    private GetterValueBinding<bool> hasPreviousScreenshotBinding = null!;

    private ValueBinding<bool> isRefreshingBinding = null!;

    private ValueBinding<Screenshot?> screenshotBinding = null!;

    private ValueBinding<LocalizedString?> errorBinding = null!;

    private TriggerBinding previousScreenshotBinding = null!;

    private TriggerBinding nextScreenshotBinding = null!;

    private TriggerBinding favoriteScreenshotBinding = null!;

    private TriggerBinding reportScreenshotBinding = null!;

    private readonly IList<Screenshot> screenshotsQueue =
        new List<Screenshot>();

    private int currentScreenshotIndex = -1;

    /// <summary>
    /// Indicates the previous game mode to refresh the screenshot when the user
    /// returns to the main menu.
    /// Note: it is initialized with <see cref="GameMode.MainMenu"/> and not the
    /// default value, it is intentional.
    /// </summary>
    private GameMode previousGameMode = GameMode.MainMenu;

    private bool isTogglingFavorite;

    protected override void OnCreate() {
        base.OnCreate();

        try {
            // No need to OnUpdate as there are no bindings that require it,
            // they are manually updated when needed.
            this.Enabled = false;

            this.imagePreloaderUISystem =
                this.World.GetOrCreateSystemManaged<ImagePreloaderUISystem>();

            this.defaultImageUriBinding = new ValueBinding<string>(
                MenuUISystem.BindingGroup, "defaultImageUri",
                MenuUISystem.VanillaDefaultImageUri);

            this.hasPreviousScreenshotBinding = new GetterValueBinding<bool>(
                MenuUISystem.BindingGroup, "hasPreviousScreenshot",
                () => this.currentScreenshotIndex > 0);

            this.isRefreshingBinding = new ValueBinding<bool>(
                MenuUISystem.BindingGroup, "isRefreshing",
                false);

            this.screenshotBinding = new ValueBinding<Screenshot?>(
                MenuUISystem.BindingGroup, "screenshot",
                null,
                new ValueWriter<Screenshot?>().Nullable());

            this.errorBinding = new ValueBinding<LocalizedString?>(
                MenuUISystem.BindingGroup, "error",
                null,
                new ValueWriter<LocalizedString>().Nullable());

            this.previousScreenshotBinding = new TriggerBinding(
                MenuUISystem.BindingGroup, "previousScreenshot",
                this.PreviousScreenshot);

            this.nextScreenshotBinding = new TriggerBinding(
                MenuUISystem.BindingGroup, "nextScreenshot",
                this.NextScreenshot);

            this.favoriteScreenshotBinding = new TriggerBinding(
                MenuUISystem.BindingGroup, "favoriteScreenshot",
                this.FavoriteScreenshot);

            this.reportScreenshotBinding = new TriggerBinding(
                MenuUISystem.BindingGroup, "reportScreenshot",
                this.ReportScreenshot);

            this.AddBinding(this.defaultImageUriBinding);
            this.AddBinding(this.hasPreviousScreenshotBinding);
            this.AddBinding(this.isRefreshingBinding);
            this.AddBinding(this.screenshotBinding);
            this.AddBinding(this.errorBinding);
            this.AddBinding(this.previousScreenshotBinding);
            this.AddBinding(this.nextScreenshotBinding);
            this.AddBinding(this.favoriteScreenshotBinding);
            this.AddBinding(this.reportScreenshotBinding);

            // Select game modes that are known to be appropriate for loading
            // our first screenshot when the mod is loaded.
            // All these game mods can be active when the mod is loaded.
            // - `MainMenu` when mods initialize late.
            // - `None` when the game is booting and mods are loaded early.
            // - `Other` when the game is booting normally but there is some
            //   problem with Paradox Mods, as it was observed. It is also the
            //   default state before anything is loaded, so it's a good idea to
            //   include it anyway.
            // There can be other possibilities! For example, when the user
            // clicked "Continue" their game in the Paradox launcher.
            if (GameManager.instance.gameMode
                is GameMode.MainMenu
                or GameMode.None
                or GameMode.Other) {
                this.NextScreenshot();
            }
        }
        catch (Exception ex) {
            Mod.Log.ErrorFatal(ex);
        }
    }

    /// <summary>
    /// Lifecycle method used for changing the current screenshot when the user
    /// returns to the main menu.
    /// </summary>
    protected override void OnGameLoadingComplete(
        Purpose purpose,
        GameMode mode) {
        // The condition serves two purposes:
        // 1. Call NextScreenshot when the user returns to the main menu from
        //    another game mode.
        // 2. Avoid potentially repeating the NextScreenshot call when the game
        //    boots and mods are initialized before the first game mode is set,
        //    this happens rarely, but it's possible.
        if (mode is GameMode.MainMenu &&
            this.previousGameMode is not GameMode.MainMenu) {
            this.NextScreenshot();
        }

        this.previousGameMode = mode;
    }

    /// <summary>
    /// Switches the current screenshot to the previous if there is one
    /// (<see cref="screenshotsQueue"/>).
    /// The method is `async void` because it is designed to be called in a
    /// fire-and-forget manner, and it should be designed to never throw.
    /// </summary>
    private async void PreviousScreenshot() {
        if (this.isRefreshingBinding.value) {
            return;
        }

        if (this.currentScreenshotIndex <= 0) {
            Mod.Log.ErrorSilent(
                $"Menu: {nameof(this.PreviousScreenshot)}: " +
                $"Cannot go back, already at the first screenshot.");
        }

        this.isRefreshingBinding.Update(true);

        var screenshot = this.screenshotsQueue[--this.currentScreenshotIndex];

        // We still need to make sure the image is preloaded, because these
        // images aren't kept long in cohtml's cache; if the user clicks
        // Previous a few times this is necessary.
        screenshot =
            await this.LoadScreenshot(screenshot: screenshot, preload: false);

        // There was an error when preloading the previous image.
        if (screenshot is not null) {
            this.screenshotBinding.Update(screenshot);
            this.hasPreviousScreenshotBinding.Update();
        }

        Mod.Log.Info(
            $"Menu: {nameof(this.PreviousScreenshot)}: Displaying {screenshot} " +
            $"(queue idx {this.currentScreenshotIndex}/" +
            $"{this.screenshotsQueue.Count - 1}).");

        this.isRefreshingBinding.Update(false);
    }

    /// <summary>
    /// Switches the current screenshot to the next if there is one
    /// (<see cref="screenshotsQueue"/>), otherwise it loads a new one.
    /// Then it preloads the next screenshot again in the background.
    /// The method is `async void` because it is designed to be called in a
    /// fire-and-forget manner, and it should be designed to never throw.
    /// </summary>
    private async void NextScreenshot() {
        if (this.isRefreshingBinding.value) {
            return;
        }

        this.isRefreshingBinding.Update(true);

        Screenshot? screenshot;

        // If there is a preloaded screenshot next in queue, set it as the
        // current screenshot.
        // This happens when the user first clicks "Next".
        if (this.screenshotsQueue.Count - 1 > this.currentScreenshotIndex) {
            screenshot = this.screenshotsQueue[++this.currentScreenshotIndex];
        }

        // Otherwise, load a new screenshot, add it to the queue, and set it as
        // the current screenshot.
        // This happens when the first image is loaded, or when there was an
        // error preloading the next image in the previous NextScreenshot call.
        else {
            screenshot = await this.LoadScreenshot(preload: false);

            if (screenshot is not null) {
                this.screenshotsQueue.Add(screenshot);
                this.currentScreenshotIndex++;
            }
        }

        // There was an error, don't preload the next image, but leave the
        // previous screenshot displayed. Reset the refresh state.
        // The error binding is already updated by LoadScreenshot().
        if (screenshot is null) {
            this.isRefreshingBinding.Update(false);

            return;
        }

        // The screenshot was successfully loaded, update the screenshot being
        // displayed and asynchronously preload the next one.
        this.screenshotBinding.Update(screenshot);
        this.hasPreviousScreenshotBinding.Update();

        Mod.Log.Info(
            $"Menu: {nameof(this.NextScreenshot)}: Displaying {screenshot} " +
            $"(queue idx {this.currentScreenshotIndex}/" +
            $"{this.screenshotsQueue.Count - 1}).");

        if (this.currentScreenshotIndex < this.screenshotsQueue.Count - 1) {
            // If we are not at the end of the queue (the user clicked previous
            // once or more), we're done as we have next screenshots in stock,
            // so we don't have to preload the next one.
            this.isRefreshingBinding.Update(false);
        }
        else {
            // If we are viewing the last screenshot in the queue, prepare the
            // next one in the background.
            PreloadNextScreenshot();

            // It also means the current screenshot was just viewed.
            MarkViewed();
        }

        return;

        // Fire-and-forget async method that should be designed to never throw.
        async void PreloadNextScreenshot() {
            // Variable used below to avoid infinite loops when there is only
            // one screenshot in database (that can happen during development).
            #if DEBUG
            var iterations = 0;
            #endif

            Screenshot? nextScreenshot;

            // The loop is a workaround to avoid loading the same screenshot
            // twice if the server returns the same screenshot twice (or more).
            // This should be extremely rare, only happening in dev mode with a
            // small number of screenshots and the random algorithm without
            // views taken into account because all screenshots have been seen.
            // The check is cheap, and it's more complex to implement
            // server-side, so let's do that frontend-side.
            do {
                nextScreenshot = await this.LoadScreenshot(preload: true);
            } while (
                #if DEBUG
                iterations++ < 20 &&
                #endif
                nextScreenshot is not null &&
                nextScreenshot.Id ==
                this.screenshotBinding.value?.Id);

            if (nextScreenshot is not null) {
                this.screenshotsQueue.Add(nextScreenshot);

                // Trim queue if it's more than 20 screenshots long.
                if (this.screenshotsQueue.Count > 20) {
                    this.screenshotsQueue.RemoveAt(0);
                }
            }

            // Release the refresh lock.
            // If any code above is susceptible to throw, ensure this is called
            // inside a finally block.
            this.isRefreshingBinding.Update(false);
        }

        // Fire-and-forget async method that should be designed to never throw.
        async void MarkViewed() {
            try {
                await HttpQueries.MarkScreenshotViewed(screenshot.Id);
            }
            catch (Exception ex) {
                Mod.Log.ErrorSilent(ex);
            }
        }
    }

    /// <summary>
    /// Loads a new screenshot from the server and preloads the image in the UI,
    /// also is responsible to handle all errors.
    /// </summary>
    /// <param name="preload">
    /// If true, network errors will be logged, but not displayed, as it is a
    /// non-critical background operation.<br/>
    /// It is the responsibility of the caller to handle the fact that the
    /// preloading failed, and ex. retry a classic loading operation the next
    /// time the user refreshes the image.
    /// </param>
    /// <param name="screenshot">
    /// The screenshot to preload, if null, a new one will be fetched from the
    /// server.
    /// </param>
    /// <returns>
    /// A <see cref="Screenshot"/> if the API call *and* image were successful,
    /// null if there was an error.
    /// </returns>
    private async Task<Screenshot?> LoadScreenshot(
        bool preload,
        Screenshot? screenshot = null) {
        try {
            screenshot ??= await HttpQueries.GetRandomScreenshotWeighted();

            var imageUrl = Mod.Settings.ScreenshotResolution switch {
                "fhd" => screenshot.ImageUrlFHD,
                "4k" => screenshot.ImageUrl4K,
                var resolution => throw new InvalidOperationException(
                    $"Unknown screenshot resolution: {resolution}.")
            };

            await this.imagePreloaderUISystem.Preload(imageUrl);

            if (!preload) {
                this.errorBinding.Update(null);
            }

            Mod.Log.Info(
                $"Menu: {(preload ? "Preloaded" : "Loaded")} {screenshot} " +
                $"({imageUrl}).");

            return screenshot;
        }
        catch (Exception ex) when (preload) {
            Mod.Log.ErrorSilent(ex);

            return null;
        }
        catch (Exception ex) when (this.IsNetworkError(ex)) {
            this.errorBinding.Update(ex.GetUserFriendlyMessage());

            return null;
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);

            return null;
        }
    }

    /// <summary>
    /// Toggle the favorite status of the current screenshot, with an optimistic
    /// UI update.
    /// The method is `async void` because it is designed to be called in a
    /// fire-and-forget manner, and it should be designed to never throw.
    /// </summary>
    private async void FavoriteScreenshot() {
        if (this.isTogglingFavorite ||
            this.isRefreshingBinding.value ||
            this.screenshotBinding.value is null) {
            return;
        }

        this.isTogglingFavorite = true;

        var prevScreenshot = this.screenshotBinding.value;

        var updatedScreenshot = prevScreenshot with {
            IsFavorite = !prevScreenshot.IsFavorite,
            FavoritesCount = prevScreenshot.FavoritesCount +
                             (prevScreenshot.IsFavorite ? -1 : 1)
        };

        // Replace current screenshot with the liked one.
        this.screenshotsQueue[this.currentScreenshotIndex] = updatedScreenshot;
        this.screenshotBinding.Update(updatedScreenshot);

        try {
            await HttpQueries.FavoriteScreenshot(
                updatedScreenshot.Id,
                favorite: updatedScreenshot.IsFavorite);
        }
        catch (HttpException ex) {
            ErrorDialogManager.ShowErrorDialog(new ErrorDialog {
                localizedTitle = "HallOfFame.Common.OOPS",
                localizedMessage = ex.GetUserFriendlyMessage(),
                actions = ErrorDialog.Actions.None
            });

            // Revert the optimistic UI update.
            this.screenshotsQueue[this.currentScreenshotIndex] = prevScreenshot;
            this.screenshotBinding.Update(prevScreenshot);
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);
        }
        finally {
            this.isTogglingFavorite = false;
        }
    }

    private bool IsNetworkError(Exception ex) {
        return ex
            is HttpException
            or ImagePreloaderUISystem.ImagePreloadFailedException;
    }

    private void ReportScreenshot() {
        var screenshot = this.screenshotBinding.value;

        if (screenshot is null) {
            throw new ArgumentNullException(nameof(this.screenshotBinding));
        }

        var dialog = new ConfirmationDialog(
            new LocalizedString(
                "HallOfFame.Systems.MenuUI.CONFIRM_REPORT_DIALOG[Title]",
                "Report screenshot {CITY_NAME} by {AUTHOR_NAME}?",
                new Dictionary<string, ILocElement> {
                    {
                        "CITY_NAME",
                        LocalizedString.Value(screenshot.CityName)
                    }, {
                        "AUTHOR_NAME",
                        LocalizedString.Value(screenshot.Creator
                            ?.CreatorName)
                    }
                }),
            LocalizedString.IdWithFallback(
                "HallOfFame.Systems.MenuUI.CONFIRM_REPORT_DIALOG[Message]",
                "Report this screenshot to the moderation team?"),
            LocalizedString.IdWithFallback(
                "HallOfFame.Systems.MenuUI.CONFIRM_REPORT_DIALOG[ConfirmAction]",
                "Report screenshot"),
            LocalizedString.IdWithFallback(
                "Common.ACTION[Cancel]",
                "Cancel"));

        GameManager.instance.userInterface.appBindings
            .ShowConfirmationDialog(dialog, OnConfirmOrCancel);

        return;

        async void OnConfirmOrCancel(int choice) {
            if (choice is not 0) {
                return;
            }

            try {
                await HttpQueries.ReportScreenshot(screenshot.Id);

                var successDialog = new MessageDialog(
                    LocalizedString.IdWithFallback(
                        "HallOfFame.Systems.MenuUI.REPORT_SUCCESS_DIALOG[Title]",
                        "Thank you"),
                    LocalizedString.IdWithFallback(
                        "HallOfFame.Systems.MenuUI.REPORT_SUCCESS_DIALOG[Message]",
                        "The screenshot has been reported to the moderation team."),
                    LocalizedString.IdWithFallback(
                        "Common.CLOSE",
                        "Close"));

                GameManager.instance.userInterface.appBindings
                    .ShowMessageDialog(successDialog, _ => { });

                this.NextScreenshot();
            }
            catch (HttpException ex) {
                ErrorDialogManager.ShowErrorDialog(new ErrorDialog {
                    localizedTitle = "HallOfFame.Common.OOPS",
                    localizedMessage = ex.GetUserFriendlyMessage(),
                    actions = ErrorDialog.Actions.None
                });
            }
            catch (Exception ex) {
                Mod.Log.ErrorRecoverable(ex);
            }
        }
    }
}
