using System;
using System.Threading.Tasks;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.SceneFlow;
using Game.UI;
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

    private TriggerBinding refreshScreenshotBinding = null!;

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
                MenuUISystem.BindingGroup, "currentScreenshot",
                null,
                new ValueWriter<Screenshot?>().Nullable());

            this.refreshScreenshotBinding = new TriggerBinding(
                MenuUISystem.BindingGroup, "refreshScreenshot",
                this.RefreshScreenshot);

            this.AddBinding(this.defaultImageUriBinding);
            this.AddBinding(this.isRefreshingBinding);
            this.AddBinding(this.screenshotBinding);
            this.AddBinding(this.refreshScreenshotBinding);

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

        if (this.nextScreenshot is not null) {
            this.screenshotBinding.Update(this.nextScreenshot);
        }
        else {
            var screenshot = await this.LoadScreenshot();

            if (screenshot is not null) {
                this.screenshotBinding.Update(screenshot);
            }
        }

        if (this.screenshotBinding.value is not null) {
            PreloadNextScreenshot();
        }

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
                this.nextScreenshot = await this.LoadScreenshot();
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
    private async Task<Screenshot?> LoadScreenshot() {
        try {
            var screenshot = await HttpQueries.GetRandomScreenshotWeighted();

            var imageUrl = Mod.Settings.ScreenshotResolution switch {
                "fhd" => screenshot.ImageUrlFHD,
                "4k" => screenshot.ImageUrl4K,
                var resolution => throw new InvalidOperationException(
                    $"Unknown screenshot resolution: {resolution}.")
            };

            await this.imagePreloaderUISystem.Preload(imageUrl);

            return screenshot;
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);

            return null;
        }
    }
}
