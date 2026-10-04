using System;
using Colossal.UI.Binding;
using HallOfFame.Systems;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for one <see cref="PhotoModeCatalogEntry"/> of the
/// photo mode catalog.
/// </summary>
/// <remarks>
/// Every entry writes the same properties whatever its kind, as cohtml caches a model's shape by
/// type name (see <see cref="ScreenshotValueWriter"/>).
/// </remarks>
internal sealed class PhotoModeCatalogValueWriter : IWriter<PhotoModeCatalogEntry> {
  private static readonly string TypeName = typeof(PhotoModeCatalogEntry).FullName;

  private static readonly string EnumOptionTypeName =
    $"{PhotoModeCatalogValueWriter.TypeName}/EnumOption";

  public void Write(IJsonWriter writer, PhotoModeCatalogEntry entry) {
    writer.TypeBegin(PhotoModeCatalogValueWriter.TypeName);

    writer.PropertyName("code");
    writer.Write(entry.Code);

    writer.PropertyName("group");
    writer.Write(entry.Group);

    writer.PropertyName("section");
    writer.Write(entry.Section);

    writer.PropertyName("kind");
    writer.Write(
      entry.Kind switch {
        PhotoModeCatalogEntryKind.Number => "number",
        PhotoModeCatalogEntryKind.Enum => "enum",
        PhotoModeCatalogEntryKind.Checkbox => "checkbox",
        PhotoModeCatalogEntryKind.ColorComponent => "colorComponent",
        PhotoModeCatalogEntryKind.VectorComponent => "vectorComponent",
        _ => throw new InvalidOperationException($"Unknown kind {entry.Kind}.")
      }
    );

    writer.PropertyName("fractionDigits");
    writer.Write(entry.FractionDigits);

    writer.PropertyName("enumType");
    writer.Write(entry.EnumType);

    writer.PropertyName("enumOptions");
    writer.ArrayBegin(entry.EnumOptions.Count);

    foreach (var (name, optionValue) in entry.EnumOptions) {
      writer.TypeBegin(PhotoModeCatalogValueWriter.EnumOptionTypeName);

      writer.PropertyName("name");
      writer.Write(name);

      writer.PropertyName("value");
      writer.Write(optionValue);

      writer.TypeEnd();
    }

    writer.ArrayEnd();

    writer.TypeEnd();
  }
}
