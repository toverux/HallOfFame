using Colossal.UI.Binding;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for the engine type
/// <see cref="Colossal.PSI.Common.Mod"/>, bound under the "assetMods" property.
/// </summary>
internal sealed class AssetModValueWriter : IWriter<Colossal.PSI.Common.Mod> {
  public void Write(IJsonWriter writer, Colossal.PSI.Common.Mod mod) {
    writer.TypeBegin(typeof(Colossal.PSI.Common.Mod).FullName);

    writer.PropertyName("id");
    writer.Write(mod.id);

    // Every string on the engine's mod record is null whenever the underlying mod leaves it unset,
    // while the UI takes them all as plain strings and searches two of them.
    writer.PropertyName("displayName");
    writer.Write(mod.displayName ?? string.Empty);

    writer.PropertyName("author");
    writer.Write(mod.author ?? string.Empty);

    writer.PropertyName("thumbnailPath");
    writer.Write(mod.thumbnailPath ?? string.Empty);

    writer.TypeEnd();
  }
}
