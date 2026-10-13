using Colossal.Json;
using HallOfFame.Domain;
using Xunit;

namespace HallOfFame.Tests.Domain;

public sealed class DashboardScreenshotTests {
  /// <summary>
  /// The list endpoint answers with the full screenshot, nested objects included,
  /// which the slim record must read past rather than fail on.
  /// </summary>
  [Fact]
  public void Decode_ReadsTheGridFields_AndSkipsTheRest() {
    var screenshots = JSON.MakeInto<DashboardScreenshot[]>(
      JSON.Load(
        """
        [{
          "id": "a",
          "cityName": "Springfield",
          "imageUrlThumbnail": "https://cdn/thumb.jpg",
          "createdAt": "2026-10-11T12:12:00.054Z",
          "favoritesCount": 12,
          "viewsCount": 300,
          "uniqueViewsCount": 240,
          "favoritingPercentage": 5,
          "rank": "gold",
          "viewerClicksCount": 3,
          "isReported": true,
          "paradoxModIds": [1, 2, 3],
          "renderConditions": { "time.hour": 8.5 },
          "creator": { "id": "c", "socials": [{ "platform": "discord", "clicks": 1 }] },
          "showcasedMod": null
        }]
        """
      )
    );

    var screenshot = Assert.Single(screenshots);

    Assert.Equal("a", screenshot.Id);
    Assert.Equal("Springfield", screenshot.CityName);
    Assert.Equal("https://cdn/thumb.jpg", screenshot.ImageUrlThumbnail);
    Assert.Equal(2026, screenshot.CreatedAt.Year);
    Assert.Equal(12, screenshot.LikesCount);
    Assert.Equal(300, screenshot.ViewsCount);
    Assert.Equal(240, screenshot.UniqueViewsCount);
    Assert.Equal("gold", screenshot.Rank);
    Assert.Equal(3, screenshot.ViewerClicksCount);
    Assert.True(screenshot.IsReported);
  }
}
