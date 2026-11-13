using HallOfFame.Systems.Capture;
using UnityEngine;
using Xunit;

namespace HallOfFame.Tests.Systems.Capture;

public sealed class ScreenshotCapturerTests {
  [Theory]
  [InlineData(1920, 1080, 3840, 2160)]
  [InlineData(2560, 1440, 5120, 2880)]
  [InlineData(1280, 800, 3840, 2400)]
  [InlineData(3840, 2160, 3840, 2160)]
  [InlineData(3440, 1440, 6880, 2880)]
  public void PlanRenderSize_ScreenSize_RendersAtLeast2160High(
    int screenWidth,
    int screenHeight,
    int expectedWidth,
    int expectedHeight
  ) {
    var renderSize = ScreenshotCapturer.PlanRenderSize(new Vector2Int(screenWidth, screenHeight));

    Assert.Equal(new Vector2Int(expectedWidth, expectedHeight), renderSize);
  }
}
