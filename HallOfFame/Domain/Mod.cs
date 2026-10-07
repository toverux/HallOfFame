using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

/// <summary>
/// Inbound server data decoded via <c>[DecodeAlias]</c>; the outbound UI wire format lives in
/// <see cref="HallOfFame.Utils.Writers.ModValueWriter"/>.
/// </summary>
[UsedImplicitly]
internal record Mod {
  [DecodeAlias("id")]
  internal string Id { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("paradoxModId")]
  internal int ParadoxModId { get; [UsedImplicitly] set; }

  [DecodeAlias("name")]
  internal string Name { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("authorName")]
  internal string AuthorName { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("shortDescription")]
  internal string ShortDescription { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("thumbnailUrl")]
  internal string ThumbnailUrl { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("subscribersCount")]
  internal int SubscribersCount { get; [UsedImplicitly] set; }

  [DecodeAlias("tags")]
  internal string[] Tags { get; [UsedImplicitly] set; } = [];

  /// <summary>
  /// "published", "removed", "blocked" or "unknown".
  /// </summary>
  [DecodeAlias("state")]
  internal string State { get; [UsedImplicitly] set; } = string.Empty;

  /// <summary>
  /// The game version the mod targets, as its author wrote it (ex. "1.6.*"): a hint, the game
  /// installs a mod targeting another version with a warning.
  /// </summary>
  [DecodeAlias("requiredGameVersion")]
  internal string? RequiredGameVersion { get; [UsedImplicitly] set; }

  /// <summary>
  /// The mod's size, localized by the server, as Cohtml has no <c>Intl</c>.
  /// </summary>
  [DecodeAlias("sizeFormatted")]
  internal string? SizeFormatted { get; [UsedImplicitly] set; }

  /// <summary>
  /// How long ago the mod's latest version was released, localized by the server.
  /// </summary>
  [DecodeAlias("knownLastReleasedAtFormattedDistance")]
  internal string? KnownLastReleasedAtFormattedDistance { get; [UsedImplicitly] set; }

  /// <summary>
  /// When the mod's latest version was released, as an ISO 8601 date, which the UI compares with
  /// <see cref="SkyveVerdict.ReviewedAt"/>.
  /// </summary>
  [DecodeAlias("knownLastReleasedAt")]
  internal string? KnownLastReleasedAt { get; [UsedImplicitly] set; }

  /// <summary>
  /// Null when Skyve has not reviewed the mod.
  /// </summary>
  [DecodeAlias("skyve")]
  internal SkyveVerdict? Skyve { get; [UsedImplicitly] set; }

  public override string ToString() =>
    $"Mod #{this.Id} (Paradox ID={this.ParadoxModId}) {this.Name} by {this.AuthorName}";
}
