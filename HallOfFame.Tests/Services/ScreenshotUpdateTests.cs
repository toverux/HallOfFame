using HallOfFame.Services;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class ScreenshotUpdateTests {
  [Fact]
  public void ToRequestBody_HoldsOnlyTheChangedFields() {
    var body = new ScreenshotUpdate {
      Description = "Now described",
      ShareRenderSettings = false
    }.ToRequestBody();

    Assert.Equal(2, body.Count);
    Assert.Equal("Now described", body["description"]);
    Assert.Equal(false, body["shareRenderSettings"]);
  }

  [Fact]
  public void ToRequestBody_SendsAClearedShowcasedModAsEmpty() {
    var body = new ScreenshotUpdate {
      ShowcasedModId = ""
    }.ToRequestBody();

    Assert.Equal("", body["showcasedModId"]);
  }

  [Fact]
  public void ToRequestBody_SendsAPickedShowcasedModById() {
    var body = new ScreenshotUpdate {
      ShowcasedModId = "34"
    }.ToRequestBody();

    Assert.Equal("34", body["showcasedModId"]);
  }

  [Fact]
  public void ToRequestBody_Empty_WhenNothingChanged() {
    Assert.Empty(new ScreenshotUpdate().ToRequestBody());
  }
}
