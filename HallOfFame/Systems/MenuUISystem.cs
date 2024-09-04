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

    private ValueBinding<bool> isRefreshingBinding = null!;

    private ValueBinding<Screenshot?> screenshotBinding = null!;

    private ValueBinding<LocalizedString?> errorBinding = null!;

    private TriggerBinding refreshScreenshotBinding = null!;

    private TriggerBinding reportScreenshotBinding = null!;

    private Screenshot? nextScreenshot;

    private GameMode previousGameMode = GameMode.MainMenu;

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

            this.refreshScreenshotBinding = new TriggerBinding(
                MenuUISystem.BindingGroup, "refreshScreenshot",
                this.RefreshScreenshot);

            this.reportScreenshotBinding = new TriggerBinding(
                MenuUISystem.BindingGroup, "reportScreenshot",
                this.ReportScreenshot);

            this.AddBinding(this.defaultImageUriBinding);
            this.AddBinding(this.isRefreshingBinding);
            this.AddBinding(this.screenshotBinding);
            this.AddBinding(this.errorBinding);
            this.AddBinding(this.refreshScreenshotBinding);
            this.AddBinding(this.reportScreenshotBinding);

            if (GameManager.instance.gameMode
                is GameMode.MainMenu
                or GameMode.None) {
                this.RefreshScreenshot();
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
        // 1. Avoid potentially repeating the RefreshScreenshot call when the
        //    game boots and mods are initialized before the first game mode is
        //    set, this happens rarely, but it's possible.
        // 2. Call RefreshScreenshot when the user returns to the main menu from
        //    another game mode.
        if (mode is GameMode.MainMenu &&
            this.previousGameMode is not GameMode.MainMenu) {
            this.RefreshScreenshot();
        }

        this.previousGameMode = mode;
    }

    /// <summary>
    /// Switches the current screenshot to the next if there is one
    /// (<see cref="nextScreenshot"/>), otherwise it loads a new one.
    /// Then it preloads the next screenshot again in the background.
    /// The method is `async void` because it is designed to be called in a
    /// fire-and-forget manner, and it should be designed to never throw.
    /// </summary>
    private async void RefreshScreenshot() {
        if (this.isRefreshingBinding.value) {
            return;
        }

        this.isRefreshingBinding.Update(true);

        // If there is a preloaded screenshot, use it, if not, load one.
        var screenshot =
            this.nextScreenshot ??
            await this.LoadScreenshot(preload: false);

        // Reset preloaded screenshot, as it is now the current one.
        this.nextScreenshot = null;

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

        PreloadNextScreenshot();

        return;

        async void PreloadNextScreenshot() {
            // The loop is a workaround to avoid loading the same screenshot
            // twice if the server returns the same screenshot twice (or more).
            // This should be extremely rare, only happening in dev mode with a
            // small number of screenshots and the random algorithm without
            // views taken into account because all screenshots have been seen.
            // The check is cheap, and it's more complex to implement
            // server-side, so let's do that frontend-side.
            do {
                this.nextScreenshot = await this.LoadScreenshot(preload: true);
            } while (
                this.nextScreenshot is not null &&
                this.nextScreenshot.Id ==
                this.screenshotBinding.value?.Id);

            this.isRefreshingBinding.Update(false);
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
    /// <returns>
    /// A <see cref="Screenshot"/> if the API call *and* image were successful,
    /// null if there was an error.
    /// </returns>
    private async Task<Screenshot?> LoadScreenshot(bool preload) {
        try {
            var screenshot = await HttpQueries.GetRandomScreenshotWeighted();

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

                this.RefreshScreenshot();
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
