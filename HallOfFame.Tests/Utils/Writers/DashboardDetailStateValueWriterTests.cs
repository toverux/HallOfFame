using Game.UI.Localization;
using HallOfFame.Domain;
using HallOfFame.Services;
using HallOfFame.Utils.Writers;
using Xunit;

namespace HallOfFame.Tests.Utils.Writers;

public sealed class DashboardDetailStateValueWriterTests {
  /// <inheritdoc cref="DashboardStateValueWriterTests.Write_EveryStatus_KeepsOneShapePerTypeName"/>
  [Fact]
  public void Write_EveryStatus_KeepsOneShapePerTypeName() {
    var jsonWriter = new ShapeRecordingJsonWriter();
    var writer = new DashboardDetailStateValueWriter();

    writer.Write(jsonWriter, DashboardDetailState.Closed);
    writer.Write(jsonWriter, DashboardDetailState.Loading("a"));
    writer.Write(
      jsonWriter,
      DashboardDetailState.Loaded(
        new Screenshot {
          Id = "a"
        }
      )
    );
    writer.Write(
      jsonWriter,
      DashboardDetailState.Failed("a", LocalizedString.Id("HallOfFame.Error"))
    );
    writer.Write(jsonWriter, DashboardDetailState.Closed);

    Assert.Empty(jsonWriter.ConflictingTypeNames);
  }
}
