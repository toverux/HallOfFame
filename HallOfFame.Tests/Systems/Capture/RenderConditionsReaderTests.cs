using System.Collections.Generic;
using System.Linq;
using HallOfFame.Systems.Capture;
using Xunit;

namespace HallOfFame.Tests.Systems.Capture;

public sealed class RenderConditionsReaderTests {
  [Fact]
  public void RemoveNonFiniteNumbers_LeavesOutWhatJsonCannotWrite() {
    var conditions = new Dictionary<string, object> {
      ["sun.elevation"] = float.NaN,
      ["camera.heightAboveGround"] = float.PositiveInfinity,
      ["time.hour"] = 14.5f,
      ["climate.season"] = "Summer",
      ["options.dayNightVisuals"] = true
    };

    RenderConditionsReader.RemoveNonFiniteNumbers(conditions);

    Assert.Equal(
      ["climate.season", "options.dayNightVisuals", "time.hour"],
      conditions.Keys.OrderBy(name => name)
    );
  }
}
