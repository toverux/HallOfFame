using System;
using System.Threading.Tasks;
using Game.SceneFlow;

namespace HallOfFame.Utils;

/// <summary>
/// The purpose of this simple although hacky class is to be able to preload
/// images in cohtml cache so images can be displayed instantly when needed.
/// This could be done frontend-side (it was originally done that way), but it
/// meant duplicating most of the loading and error logic on both sides, leading
/// to a lot of spaghetti code.
/// So we'll just pretend there is a native cohtml API for that =)
/// </summary>
internal static class UIImagePreloader {
    /// <summary>
    /// Script to install the image preloader API on the frontend.
    /// </summary>
    private const string PreloadFunctionScript = // language=JavaScript
        """
        window.hallOfFame = window.hallOfFame ?? {};

        window.hallOfFame.preloaderImage = new Image();

        window.hallOfFame.preloaderImage.onload =
            () => engine.trigger('hallOfFame.uiImagePreloader.onload');

        window.hallOfFame.preloaderImage.onerror =
            () => engine.trigger('hallOfFame.uiImagePreloader.onerror');

        // Setting src triggers onload/onerror on each src change, no need to
        // create another image instance.
        engine.on('hallOfFame.uiImagePreloader.preload', url => {
            window.hallOfFame.preloaderImage.src = url;
        });
        """;

    private static TaskCompletionSource<object?>? preloadCompletionSource;

    private static bool isPreloading;

    private static string? lastLoadedUrl;

    /// <summary>
    /// Install the preloader script in the cohtml view, and attaches the event
    /// listeners to catch load/error events from the frontend.
    /// </summary>
    static UIImagePreloader() {
        GameManager.instance.userInterface.view.View.ExecuteScript(
            UIImagePreloader.PreloadFunctionScript);

        GameManager.instance.userInterface.view.View.RegisterForEvent(
            "hallOfFame.uiImagePreloader.onload",
            () => UIImagePreloader.preloadCompletionSource?.SetResult(null));

        GameManager.instance.userInterface.view.View.RegisterForEvent(
            "hallOfFame.uiImagePreloader.onerror",
            () => UIImagePreloader.preloadCompletionSource?.SetException(
                new Exception("Failed to preload image.")));
    }

    /// <summary>
    /// Preloads an image in the cohtml cache.
    /// </summary>
    internal static async Task Preload(string url) {
        // For now, we don't need & support multiple concurrent preloads.
        // Can be easily done with a semaphore if needed.
        if (UIImagePreloader.isPreloading) {
            throw new InvalidOperationException(
                "Cannot preload multiple images concurrently.");
        }

        if (url == UIImagePreloader.lastLoadedUrl) {
            return;
        }

        UIImagePreloader.isPreloading = true;

        UIImagePreloader.preloadCompletionSource =
            new TaskCompletionSource<object?>();

        GameManager.instance.userInterface.view.View.TriggerEvent(
            "hallOfFame.uiImagePreloader.preload", url);

        UIImagePreloader.lastLoadedUrl = url;

        await UIImagePreloader.preloadCompletionSource.Task;

        UIImagePreloader.isPreloading = false;
    }
}
