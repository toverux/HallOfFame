using HallOfFame.Systems.Capture;
using TND.Upscaling.Framework;
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
  public void Plan_ScreenSize_RendersAtLeast2160High(
    int screenWidth,
    int screenHeight,
    int expectedWidth,
    int expectedHeight
  ) {
    var plan = ScreenshotCapturer.Plan(
      new Vector2Int(screenWidth, screenHeight),
      UpscalerName.None,
      isWine: false
    );

    Assert.Equal(new Vector2Int(expectedWidth, expectedHeight), plan.RenderSize);
  }

  [Theory]
  [InlineData(UpscalerName.XeSS3, true, true)]
  [InlineData(UpscalerName.XeSS3, false, false)]
  [InlineData(UpscalerName.DLSS4, true, false)]
  [InlineData(UpscalerName.DLSS4, false, false)]
  [InlineData(UpscalerName.FSR3, true, false)]
  [InlineData(UpscalerName.FSR3, false, false)]
  [InlineData(UpscalerName.None, true, false)]
  [InlineData(UpscalerName.None, false, false)]
  public void Plan_UpscalerAndWine_XessPrecautionOnlyForXessUnderWine(
    UpscalerName runningUpscaler,
    bool isWine,
    bool expected
  ) {
    var plan = ScreenshotCapturer.Plan(new Vector2Int(1920, 1080), runningUpscaler, isWine);

    Assert.Equal(expected, plan.IsXessPrecautionNeeded);
  }
}
