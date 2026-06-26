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

    writer.PropertyName("displayName");
    writer.Write(mod.displayName);

    writer.PropertyName("thumbnailPath");
    writer.Write(mod.thumbnailPath);

    writer.TypeEnd();
  }
}
