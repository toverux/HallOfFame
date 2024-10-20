using System;
using System.Threading;
using System.Threading.Tasks;
using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.UI;
using HallOfFame.Utils;

namespace HallOfFame.Systems;

/// <summary>
/// This system is responsible for preloading images in the cohtml cache.
/// This is used so screenshots can be preloaded and displayed instantly when
/// needed.
/// This could be done frontend-side (it was originally done that way), but it
/// meant duplicating most of the loading and error logic on both sides, leading
/// to a lot of spaghetti reconciliation code.
///
/// [NOT USED ANYMORE, loading is done only once the UI is loaded:]
/// [Another advantage of doing it this way is that we can start preloading the]
/// [very first image even before the UI mod is loaded.]
/// </summary>
internal sealed partial class ImagePreloaderUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame.imagePreloader";

    /// <summary>
    /// Script to install the image preloader event API on the frontend.
    /// </summary>
    private const string PreloadScript = // language=JavaScript
        """
        const { bindValue, trigger } = window['cs2/api'];

        const image = new Image();

        image.onload = () => trigger('hallOfFame.imagePreloader', 'onLoad');
        image.onerror = () => trigger('hallOfFame.imagePreloader', 'onError');

        const urlToPreload$ =
            bindValue('hallOfFame.imagePreloader', 'urlToPreload');

        // noinspection JSIgnoredPromiseFromCall,JSCheckFunctionSignatures False positives
        urlToPreload$.subscribe(url => url && (image.src = url));
        """;

    private static readonly SemaphoreSlim PreloadSemaphore = new(1, 1);

    private TriggerBinding onErrorBinding = null!;

    private TriggerBinding onLoadBinding = null!;

    private TaskCompletionSource<object?>? preloadCompletionSource;

    private ValueBinding<string> urlToPreloadBinding = null!;

    protected override void OnCreate() {
        base.OnCreate();

        try {
            // No need to OnUpdate as there are no bindings that require it.
            this.Enabled = false;

            this.urlToPreloadBinding = new ValueBinding<string>(
                ImagePreloaderUISystem.BindingGroup, "urlToPreload",
                string.Empty);

            this.onLoadBinding = new TriggerBinding(
                ImagePreloaderUISystem.BindingGroup, "onLoad",
                () => this.preloadCompletionSource?.SetResult(null));

            this.onErrorBinding = new TriggerBinding(
                ImagePreloaderUISystem.BindingGroup, "onError",
                () => this.preloadCompletionSource?.SetException(
                    new ImagePreloadFailedException(
                        this.urlToPreloadBinding.value)));

            this.AddBinding(this.urlToPreloadBinding);
            this.AddBinding(this.onLoadBinding);
            this.AddBinding(this.onErrorBinding);
        }
        catch (Exception ex) {
            Mod.Log.ErrorFatal(ex);
        }
    }

    /// <summary>
    /// Preloads an image in the cohtml "browser" cache, so it can be displayed
    /// instantly next time it's requested for display.
    /// Wraps <see cref="DoPreload"/> to queue successive preloads (this is just
    /// to be safe, as of now this was not technically needed).
    /// </summary>
    /// <exception cref="ImagePreloadFailedException">
    /// When cohtml failed to load the image (Image.onerror).
    /// </exception>
    internal async Task Preload(string url) {
        await ImagePreloaderUISystem.PreloadSemaphore.WaitAsync();

        try {
            await this.DoPreload(url);
        }
        finally {
            ImagePreloaderUISystem.PreloadSemaphore.Release();
        }
    }

    /// <see cref="Preload"/>
    private async Task DoPreload(string url) {
        // If the same image is requested, we don't need to preload it again.
        // (Worse, it would not trigger onload again, blocking the task.)
        if (url == this.urlToPreloadBinding.value) {
            return;
        }

        // If the binding is not connected on the frontend side, it means the
        // client script was not installed: either the game just launched or
        // the UI was hot-reloaded in dev mode.
        if (!this.urlToPreloadBinding.active) {
            // This will synchronously connect the binding, so no need to wait.
            GameManager.instance.userInterface.view.View.ExecuteScript(
                ImagePreloaderUISystem.PreloadScript);

            if (!this.urlToPreloadBinding.active) {
                throw new Exception(
                    "Failed to install the image preloader script.");
            }
        }

        this.preloadCompletionSource = new TaskCompletionSource<object?>();

        // Trigger the preload on the frontend.
        this.urlToPreloadBinding.Update(url);

        // Wait for the image to be loaded or errored.
        // Completion is set via the trigger bindings.
        await this.preloadCompletionSource.Task;
    }

    internal class ImagePreloadFailedException(string url)
        : Exception($"Failed to preload image {url}.");
}
