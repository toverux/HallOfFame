using System;
using System.Collections.Generic;
using System.Linq;
using Game.Rendering;
using Game.Rendering.CinematicCamera;

namespace HallOfFame.Systems;

/// <summary>
/// One property of the game's photo mode, as the UI needs it to list a screenshot's settings under
/// the game's own tabs, sections, and names.
/// It carries metadata only: in the main menu, the system's values are leftover state, not the
/// screenshot's.
/// </summary>
internal sealed record PhotoModeCatalogEntry {
  /// <summary>
  /// The code a screenshot's settings are stored under; a color or a vector has one property per
  /// component, its code ending with the component's suffix (<c>/r</c>, <c>/x</c>...).
  /// </summary>
  public required string Code { get; init; }

  /// <summary>
  /// The photo mode tab holding the property.
  /// </summary>
  public required string Group { get; init; }

  /// <summary>
  /// The section title the property sits under in its tab, null when it precedes any title.
  /// </summary>
  public required string? Section { get; init; }

  public required PhotoModeCatalogEntryKind Kind { get; init; }

  public required int FractionDigits { get; init; }

  /// <summary>
  /// The enum's type name, which the game keys its option names with, null for other kinds.
  /// </summary>
  public required string? EnumType { get; init; }

  public required IReadOnlyList<(string Name, int Value)> EnumOptions { get; init; }

  /// <summary>
  /// Reads the properties of the game's photo mode, in the order its panel lists them, which is
  /// also the order the system builds them in.
  /// The game's section titles are properties with neither getter nor setter: they become the
  /// <see cref="Section"/> of the properties following them, not entries of their own.
  /// </summary>
  internal static IReadOnlyList<PhotoModeCatalogEntry> Read(PhotoModeRenderSystem system) {
    var catalog = new List<PhotoModeCatalogEntry>();

    var sectionsByGroup = new Dictionary<string, string>();

    foreach (var property in system.photoModeProperties.Values) {
      if (property.getValue is null && property.setValue is null) {
        sectionsByGroup[property.group] = property.id;

        continue;
      }

      var kind = PhotoModeCatalogEntry.KindOf(property);

      catalog.Add(new PhotoModeCatalogEntry {
        Code = property.id,
        Group = property.group,
        Section = sectionsByGroup.TryGetValue(property.group, out var section) ? section : null,
        Kind = kind,
        FractionDigits = property.fractionDigits,
        EnumType = kind is PhotoModeCatalogEntryKind.Enum ? property.enumType.Name : null,
        EnumOptions = kind is PhotoModeCatalogEntryKind.Enum
          ? Enum.GetValues(property.enumType)
            .Cast<object>()
            .Select(value => (Enum.GetName(property.enumType, value), Convert.ToInt32(value)))
            .ToList()
          : []
      });
    }

    return catalog;
  }

  /// <summary>
  /// The property's kind, tested in the order the game's panel picks a property's control.
  /// </summary>
  private static PhotoModeCatalogEntryKind KindOf(PhotoModeProperty property) =>
    property switch {
      _ when property.id.Contains("/") =>
        property.overrideControl is PhotoModeProperty.OverrideControl.ColorField
          ? PhotoModeCatalogEntryKind.ColorComponent
          : PhotoModeCatalogEntryKind.VectorComponent,
      { overrideControl: PhotoModeProperty.OverrideControl.Checkbox } =>
        PhotoModeCatalogEntryKind.Checkbox,
      { enumType: not null } => PhotoModeCatalogEntryKind.Enum,
      _ => PhotoModeCatalogEntryKind.Number
    };
}

internal enum PhotoModeCatalogEntryKind {
  Number,
  Enum,
  Checkbox,
  ColorComponent,
  VectorComponent
}
