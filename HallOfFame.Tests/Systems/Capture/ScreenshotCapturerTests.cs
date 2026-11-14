using HallOfFame.Systems.Capture;
using UnityEngine;
using Xunit;

namespace HallOfFame.Tests.Systems.Capture;

public sealed class ScreenshotCapturerTests {
  [Theory]
  [InlineData(1920, 1080, 3840, 2160)]
  [InlineData(2560, 1440, 3840, 2160)]
  [InlineData(1280, 800, 3840, 2400)]
  [InlineData(3840, 2160, 3840, 2160)]
  [InlineData(3440, 1440, 5160, 2160)]
  [InlineData(1366, 768, 3842, 2160)]
  [InlineData(2560, 1600, 3840, 2400)]
  [InlineData(5120, 2880, 3840, 2160)]
  public void PlanRenderSize_ScreenSize_RendersTheSmallestSizeTheServerKeepsAt4K(
    int screenWidth,
    int screenHeight,
    int expectedWidth,
    int expectedHeight
  ) {
    var renderSize = ScreenshotCapturer.PlanRenderSize(new Vector2Int(screenWidth, screenHeight));

    Assert.Equal(new Vector2Int(expectedWidth, expectedHeight), renderSize);

    // The server keeps a capture no smaller than 3840x2160 and never enlarges one.
    Assert.True(renderSize.x >= 3840);
    Assert.True(renderSize.y >= 2160);
  }
}
