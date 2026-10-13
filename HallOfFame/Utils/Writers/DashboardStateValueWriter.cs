using System;
using Colossal.UI.Binding;
using HallOfFame.Domain;
using HallOfFame.Services;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="DashboardState"/>:
/// the status, and only the payload that status carries,
/// the UI's type being a union keyed on the status.
/// </summary>
internal sealed class DashboardStateValueWriter : IWriter<DashboardState> {
  private static readonly CollectionWriter<DashboardScreenshot> screenshotsWriter =
    new(new DashboardScreenshotValueWriter());

  private static readonly CreatorStatsValueWriter statsWriter = new();

  public void Write(IJsonWriter writer, DashboardState value) {
    var stats = value.Status is DashboardStatus.Loaded ? value.Stats : null;
    var error = value.Status is DashboardStatus.Error ? value.Error : null;

    // cohtml caches an object's shape by its type name and crashes the game when a later write
    // under that name carries other properties, so the payload a status adds is in the name.
    writer.TypeBegin(
      $"{typeof(DashboardState).FullName}?Collection={stats is not null}&Error={error is not null}"
    );

    writer.PropertyName("status");
    writer.Write(
      value.Status switch {
        DashboardStatus.Closed => "closed",
        DashboardStatus.Loading => "loading",
        DashboardStatus.Loaded => "loaded",
        DashboardStatus.Error => "error",
        _ => throw new InvalidOperationException($"Unknown status {value.Status}.")
      }
    );

    if (stats is not null) {
      writer.PropertyName("screenshots");
      DashboardStateValueWriter.screenshotsWriter.Write(writer, value.Screenshots);

      writer.PropertyName("stats");
      DashboardStateValueWriter.statsWriter.Write(writer, stats);
    }

    if (error is { } message) {
      writer.PropertyName("error");
      message.Write(writer);
    }

    writer.TypeEnd();
  }
}
