using Colossal.Json;
using HallOfFame.Domain;
using Xunit;

namespace HallOfFame.Tests.Domain;

public sealed class ScreenshotTests {
  /// <summary>
  /// The conditions are an open map, so each value keeps the type it was uploaded with, which the
  /// UI tells apart.
  /// </summary>
  [Fact]
  public void Decode_RenderConditions_KeepsEachValueType() {
    var screenshot = JSON.MakeInto<Screenshot>(
      JSON.Load(
        """
        {
          "renderConditions": {
            "time.hour": 14.5,
            "climate.season": "Summer",
            "options.dayNightVisuals": false,
            "nested": { "ignored": 1 }
          }
        }
        """
      )
    );

    Assert.Equal(14.5, Assert.IsType<double>(screenshot.RenderConditions["time.hour"]));
    Assert.Equal("Summer", Assert.IsType<string>(screenshot.RenderConditions["climate.season"]));
    Assert.False(Assert.IsType<bool>(screenshot.RenderConditions["options.dayNightVisuals"]));

    // The server accepts no other kind of value, so one is dropped rather than failing the decode.
    Assert.False(screenshot.RenderConditions.ContainsKey("nested"));
  }

  [Fact]
  public void Decode_NoRenderConditions_GivesAnEmptyMap() {
    var screenshot = JSON.MakeInto<Screenshot>(JSON.Load("""{ "id": "1" }"""));

    Assert.Empty(screenshot.RenderConditions);
  }
}
