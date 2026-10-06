using System;
using Colossal.UI.Binding;
using HallOfFame.Services;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="PlaysetState"/>.
/// </summary>
internal sealed class PlaysetStateValueWriter : IWriter<PlaysetState?> {
  private static readonly ModValueWriter modWriter = new();

  public void Write(IJsonWriter writer, PlaysetState? value) {
    // Null until a Playset tab is first opened.
    if (value is null) {
      writer.WriteNull();

      return;
    }

    writer.TypeBegin(typeof(PlaysetState).FullName);

    writer.PropertyName("screenshotId");
    writer.Write(value.ScreenshotId);

    writer.PropertyName("status");
    writer.Write(
      value.Status switch {
        PlaysetStatus.Loading => "loading",
        PlaysetStatus.Loaded => "loaded",
        PlaysetStatus.Failed => "failed",
        _ => throw new InvalidOperationException($"Unknown status {value.Status}.")
      }
    );

    // Empty but present unless loaded, so the payload keeps one shape.
    writer.PropertyName("mods");
    writer.ArrayBegin(value.Mods.Count);

    foreach (var mod in value.Mods) {
      PlaysetStateValueWriter.modWriter.Write(writer, mod);
    }

    writer.ArrayEnd();

    writer.TypeEnd();
  }
}
