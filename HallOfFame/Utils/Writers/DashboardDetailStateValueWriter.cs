using Colossal.UI.Binding;
using HallOfFame.Services;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="DashboardDetailState"/>:
/// the status, the screenshot it opened on, and only the payload that status carries,
/// the UI's type being a union keyed on the status.
/// </summary>
internal sealed class DashboardDetailStateValueWriter : IWriter<DashboardDetailState> {
  private static readonly ScreenshotValueWriter screenshotWriter = new();

  public void Write(IJsonWriter writer, DashboardDetailState value) {
    var screenshot = value.Status is DashboardStatus.Loaded ? value.Screenshot : null;
    var error = value.Status is DashboardStatus.Error ? value.Error : null;

    // The payload a status adds is in the type name, as in DashboardStateValueWriter.
    writer.TypeBegin(
      $"{typeof(DashboardDetailState).FullName}" +
      $"?Id={value.ScreenshotId is not null}" +
      $"&Screenshot={screenshot is not null}" +
      $"&Error={error is not null}"
    );

    writer.PropertyName("status");
    writer.Write(value.Status.ToWireName());

    if (value.ScreenshotId is {} screenshotId) {
      writer.PropertyName("screenshotId");
      writer.Write(screenshotId);
    }

    if (screenshot is not null) {
      writer.PropertyName("screenshot");
      DashboardDetailStateValueWriter.screenshotWriter.Write(writer, screenshot);
    }

    if (error is {} message) {
      writer.PropertyName("error");
      message.Write(writer);
    }

    writer.TypeEnd();
  }
}
