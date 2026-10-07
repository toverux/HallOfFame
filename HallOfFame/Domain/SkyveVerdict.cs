using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

/// <summary>
/// Skyve's compatibility review of a mod, as the server relays it.
/// Inbound server data decoded via <c>[DecodeAlias]</c>; the outbound UI wire format lives in
/// <see cref="HallOfFame.Utils.Writers.SkyveVerdictValueWriter"/>.
/// </summary>
[UsedImplicitly]
internal record SkyveVerdict {
  /// <summary>
  /// One of Skyve's stability values in camelCase (ex. "brokenFromPatch"), passed on as is: the UI
  /// decides what it knows of them.
  /// </summary>
  [DecodeAlias("stability")]
  internal string Stability { get; [UsedImplicitly] set; } = string.Empty;

  /// <summary>
  /// The reviewer's note, in English.
  /// </summary>
  [DecodeAlias("note")]
  internal string? Note { get; [UsedImplicitly] set; }

  /// <summary>
  /// When the mod was reviewed, as an ISO 8601 date.
  /// </summary>
  [DecodeAlias("reviewedAt")]
  internal string? ReviewedAt { get; [UsedImplicitly] set; }

  /// <summary>
  /// How long ago the mod was reviewed, localized by the server.
  /// </summary>
  [DecodeAlias("reviewedAtFormattedDistance")]
  internal string? ReviewedAtFormattedDistance { get; [UsedImplicitly] set; }

  /// <summary>
  /// The game version the mod was reviewed on, build suffix included (ex. "1.5.2f1").
  /// </summary>
  [DecodeAlias("reviewedGameVersion")]
  internal string? ReviewedGameVersion { get; [UsedImplicitly] set; }
}
