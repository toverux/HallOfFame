using Game.UI.Localization;
using HallOfFame.Domain;
using HallOfFame.Services;
using HallOfFame.Utils.Writers;
using Xunit;

namespace HallOfFame.Tests.Utils.Writers;

public sealed class DashboardStateValueWriterTests {
  /// <summary>
  /// cohtml caches an object's shape by its type name and crashes the game in V8 when a later
  /// write under that name carries other properties, as the state does from one status to the next.
  /// </summary>
  [Fact]
  public void Write_EveryStatus_KeepsOneShapePerTypeName() {
    var jsonWriter = new ShapeRecordingJsonWriter();
    var writer = new DashboardStateValueWriter();

    writer.Write(jsonWriter, DashboardState.Closed);
    writer.Write(jsonWriter, DashboardState.Loading);
    writer.Write(
      jsonWriter,
      DashboardState.Loaded([new DashboardScreenshot()], new CreatorStats())
    );
    writer.Write(jsonWriter, DashboardState.Failed(LocalizedString.Id("HallOfFame.Error")));
    writer.Write(jsonWriter, DashboardState.Closed);

    Assert.Empty(jsonWriter.ConflictingTypeNames);
  }
}
