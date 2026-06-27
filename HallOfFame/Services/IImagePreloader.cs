using System;
using System.Threading.Tasks;

namespace HallOfFame.Services;

/// <summary>
/// Consumer-owned port for preloading an image into the cohtml "browser" cache, so it can be
/// displayed instantly the next time it is requested.
/// The production implementation is <see cref="HallOfFame.Systems.ImagePreloaderUISystem"/>; tests
/// substitute a fake.
/// The port lives here, in <c>Services/</c>, and not next to the system, because the project
/// extracts logic *out of* systems into services: a service depending on a port declared in the
/// engine layer would point the dependency backwards (Services to Systems).
/// This intentionally differs from <see cref="HallOfFame.Http.IHallOfFameApi"/> living in
/// <c>Http/</c>, which is a genuine *lower* layer; <c>Systems</c> is a *higher* one.
/// </summary>
internal interface IImagePreloader {
  /// <summary>
  /// Preloads the image at <paramref name="url"/> and completes once it is loaded.
  /// </summary>
  /// <exception cref="ImagePreloadFailedException">
  /// When the image failed to load.
  /// </exception>
  Task Preload(string url);
}

/// <summary>
/// Thrown by an <see cref="IImagePreloader"/> when the image at the given URL failed to load.
/// It lives with the port (not on the engine implementation) so consumers can classify the error
/// without reaching into the <c>Systems</c> layer.
/// </summary>
internal sealed class ImagePreloadFailedException(string url)
  : Exception($"Failed to preload image {url}.");
