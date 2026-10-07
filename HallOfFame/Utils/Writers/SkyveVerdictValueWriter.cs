using Colossal.UI.Binding;
using HallOfFame.Domain;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="SkyveVerdict"/>.
/// </summary>
internal sealed class SkyveVerdictValueWriter : IWriter<SkyveVerdict?> {
  /// <summary>
  /// Writes every part, null ones included, so every verdict keeps one shape.
  /// </summary>
  public void Write(IJsonWriter writer, SkyveVerdict? value) {
    // Null for a mod Skyve has not reviewed.
    if (value is null) {
      writer.WriteNull();

      return;
    }

    writer.TypeBegin(typeof(SkyveVerdict).FullName);

    writer.PropertyName("stability");
    writer.Write(value.Stability);

    writer.PropertyName("note");
    writer.Write(value.Note);

    writer.PropertyName("reviewedAt");
    writer.Write(value.ReviewedAt);

    writer.PropertyName("reviewedAtFormattedDistance");
    writer.Write(value.ReviewedAtFormattedDistance);

    writer.PropertyName("reviewedGameVersion");
    writer.Write(value.ReviewedGameVersion);

    writer.TypeEnd();
  }
}
