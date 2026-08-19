using System;

namespace HallOfFame.Utils;

/// <summary>
/// The external Hall of Fame web viewer, a third-party website browsing Hall of Fame content.
/// Its URL path scheme is an external contract owned by the server, which documents and redirects
/// to it; the mod holds a second copy so it can compose a clean, untracked link to copy.
/// This is the mod's only copy: everything pointing at the viewer composes its URL here.
/// </summary>
internal static class WebViewer {
  internal const string BaseUrl = "https://viewer.halloffame.mtq.io";

  /// <summary>
  /// The viewer page for a single screenshot, keyed by screenshot ID.
  /// </summary>
  internal static string ScreenshotPageUrl(string screenshotId) =>
    $"{WebViewer.BaseUrl}/city/{screenshotId}";

  /// <summary>
  /// The viewer page listing everything a creator shared.
  /// It is keyed by their public ID or by their name, both of which the viewer resolves.
  /// The ID is preferable where it is available, since it survives a rename.
  /// Never the mod's Creator ID, which is a credential rather than a public identifier.
  /// </summary>
  internal static string CreatorPageUrl(string creator) =>
    $"{WebViewer.BaseUrl}/?creator={Uri.EscapeDataString(creator)}";
}
