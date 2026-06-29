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
  internal Func<Task<Creator>>? GetMeImpl { get; init; }

  internal Func<Task<Creator>>? UpdateMeImpl { get; init; }

  internal Func<Task<CreatorStats>>? GetCreatorStatsImpl { get; init; }

  internal Func<Task<Screenshot>>? GetRandomScreenshotWeightedImpl { get; init; }

  internal Func<string, bool, Task<View>>? LikeScreenshotImpl { get; init; }

  internal Func<string, Task<View>>? MarkScreenshotViewedImpl { get; init; }

  internal Func<UploadScreenshotParams, Task<Screenshot>>? UploadScreenshotImpl { get; init; }

  internal Func<string, Task<Screenshot>>? ReportScreenshotImpl { get; init; }

  internal Func<string, Task<byte[]>>? DownloadImageImpl { get; init; }

  #if DEBUG
  internal Func<string, Task<Screenshot>>? GetScreenshotImpl { get; init; }
  #endif

  public Task<CreatorStats> GetCreatorStats() =>
    this.GetCreatorStatsImpl?.Invoke() ?? throw new NotImplementedException();

  public Task<Creator> GetMe() =>
    this.GetMeImpl?.Invoke() ?? throw new NotImplementedException();

  public Task<Creator> UpdateMe() =>
    this.UpdateMeImpl?.Invoke() ?? throw new NotImplementedException();

  #if DEBUG
  public Task<Screenshot> GetScreenshot(string screenshotId) =>
    this.GetScreenshotImpl?.Invoke(screenshotId) ?? throw new NotImplementedException();
  #endif

  public Task<Screenshot> GetRandomScreenshotWeighted() =>
    this.GetRandomScreenshotWeightedImpl?.Invoke() ?? throw new NotImplementedException();

  public Task<View> LikeScreenshot(string screenshotId, bool liked) =>
    this.LikeScreenshotImpl?.Invoke(screenshotId, liked) ?? throw new NotImplementedException();

  public Task<View> MarkScreenshotViewed(string screenshotId) =>
    this.MarkScreenshotViewedImpl?.Invoke(screenshotId) ?? throw new NotImplementedException();

  public Task<Screenshot> ReportScreenshot(string screenshotId) =>
    this.ReportScreenshotImpl?.Invoke(screenshotId) ?? throw new NotImplementedException();

  public Task<Screenshot> UploadScreenshot(UploadScreenshotParams @params) =>
    this.UploadScreenshotImpl?.Invoke(@params) ?? throw new NotImplementedException();

  public Task<byte[]> DownloadImage(string url) =>
    this.DownloadImageImpl?.Invoke(url) ?? throw new NotImplementedException();

  public Task<string> ResolveParadoxModsUsername(string url) =>
    throw new NotImplementedException();
}
