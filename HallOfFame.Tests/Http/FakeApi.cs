using System;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;

namespace HallOfFame.Tests.Http;

/// <summary>
/// Handwritten <see cref="IHallOfFameApi"/> test double.
/// Each test wires only the method it needs through a settable delegate; every other method throws
/// <see cref="NotImplementedException"/> so an unexpected call fails loudly.
/// No mocking library is used yet; this is deliberately the smallest viable fake.
/// </summary>
internal sealed class FakeApi : IHallOfFameApi {
  internal Func<Task<CreatorStats>>? GetCreatorStatsImpl { get; init; }

  internal Func<Task<Screenshot>>? GetRandomScreenshotWeightedImpl { get; init; }

  #if DEBUG
  internal Func<string, Task<Screenshot>>? GetScreenshotImpl { get; init; }
  #endif

  public Task<CreatorStats> GetCreatorStats() =>
    this.GetCreatorStatsImpl?.Invoke() ?? throw new NotImplementedException();

  public Task<Creator> GetMe() => throw new NotImplementedException();

  public Task<Creator> UpdateMe() => throw new NotImplementedException();

  #if DEBUG
  public Task<Screenshot> GetScreenshot(string screenshotId) =>
    this.GetScreenshotImpl?.Invoke(screenshotId) ?? throw new NotImplementedException();
  #endif

  public Task<Screenshot> GetRandomScreenshotWeighted() =>
    this.GetRandomScreenshotWeightedImpl?.Invoke() ?? throw new NotImplementedException();

  public Task<View> LikeScreenshot(string screenshotId, bool liked) =>
    throw new NotImplementedException();

  public Task<View> MarkScreenshotViewed(string screenshotId) =>
    throw new NotImplementedException();

  public Task<Screenshot> ReportScreenshot(string screenshotId) =>
    throw new NotImplementedException();

  public Task<Screenshot> UploadScreenshot(UploadScreenshotParams @params) =>
    throw new NotImplementedException();

  public Task<byte[]> DownloadImage(string url) => throw new NotImplementedException();

  public Task<string> ResolveParadoxModsUsername(string url) =>
    throw new NotImplementedException();
}
