using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class ScreenshotUploaderTests {
  [Fact]
  public async Task Upload_Success_LeavesCurrentProgressComplete() {
    var api = new FakeApi {
      UploadScreenshotImpl = _ => Task.FromResult(new Screenshot { Id = "42" })
    };

    var uploader = ScreenshotUploaderTests.MakeUploader(api);

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.True(uploader.CurrentProgress!.Value.IsComplete);
  }

  [Fact]
  public async Task Upload_HttpException_ReportsError_AndResetsProgress() {
    var api = new FakeApi {
      UploadScreenshotImpl = _ =>
        Task.FromException<Screenshot>(new HttpNetworkException("1", "boom"))
    };

    var reported = new List<HttpException>();
    var uploader = ScreenshotUploaderTests.MakeUploader(api, reportError: reported.Add);

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.IsType<HttpNetworkException>(Assert.Single(reported));

    // The error path nulls the model so the UI stops showing a stuck progress bar.
    Assert.Null(uploader.CurrentProgress);
  }

  [Fact]
  public async Task Upload_GenericException_LogsRecoverable_AndResetsProgress() {
    var api = new FakeApi {
      UploadScreenshotImpl = _ =>
        Task.FromException<Screenshot>(new InvalidOperationException("boom"))
    };

    var logged = new List<Exception>();
    var reported = new List<HttpException>();

    var uploader = new ScreenshotUploader(
      api,
      new FakeModLog { ErrorRecoverableImpl = logged.Add },
      reported.Add
    );

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    // A non-HTTP error is logged as recoverable, not surfaced through the HTTP error callback.
    Assert.IsType<InvalidOperationException>(Assert.Single(logged));
    Assert.Empty(reported);
    Assert.Null(uploader.CurrentProgress);
  }

  /// <summary>
  /// The merge is the genuinely untested logic: the upload request is assembled from three sources,
  /// the frozen snapshot, the live city name, and the user's form, and each field must come from
  /// the right one.
  /// </summary>
  [Fact]
  public async Task Upload_MergesSnapshotCityNameAndForm_IntoUploadParams() {
    UploadScreenshotParams? captured = null;

    var api = new FakeApi {
      UploadScreenshotImpl = @params => {
        captured = @params;

        return Task.FromResult(new Screenshot { Id = "1" });
      }
    };

    var uploader = ScreenshotUploaderTests.MakeUploader(api);

    var imageBytes = new byte[] { 1, 2, 3 };
    var renderSettings = new Dictionary<string, float> { ["bloom"] = 1.5f };
    var modIds = new[] { "mod.a", "mod.b" };

    var snapshot = ScreenshotUploaderTests.MakeSnapshot(
      achievedMilestone: 7,
      population: 12345,
      mapName: "Map A",
      imageBytes: imageBytes,
      renderSettings: renderSettings,
      modIds: modIds
    );

    var form = ScreenshotUploaderTests.MakeForm(
      shareModIds: true,
      shareRenderSettings: false,
      showcasedModId: "show.mod",
      description: "A nice city"
    );

    await uploader.Upload(snapshot, "Live City", form);

    Assert.NotNull(captured);

    var sent = captured!;

    // From the live city name argument (deliberately not frozen in the snapshot).
    Assert.Equal("Live City", sent.CityName);

    // From the frozen snapshot.
    Assert.Equal(7, sent.CityMilestone);
    Assert.Equal(12345, sent.CityPopulation);
    Assert.Equal("Map A", sent.MapName);
    Assert.Same(modIds, sent.ModIds);
    Assert.Same(renderSettings, sent.RenderSettings);
    Assert.Same(imageBytes, sent.ScreenshotData);

    // From the user's form input.
    Assert.True(sent.ShareModIds);
    Assert.False(sent.ShareRenderSettings);
    Assert.Equal("show.mod", sent.ShowcasedModId);
    Assert.Equal("A nice city", sent.Description);
  }

  /// <summary>
  /// The uploader must route the API's progress callback into the model the UI reads back through
  /// <see cref="ScreenshotUploader.CurrentProgress"/>.
  /// </summary>
  [Fact]
  public async Task Upload_DrivesCurrentProgress_FromTheProgressHandler() {
    ScreenshotUploader uploader = null!;
    var observedUpload = new List<float>();

    var api = new FakeApi {
      UploadScreenshotImpl = @params => {
        // The fake plays the role of UnityWebRequest, pumping the progress callback mid-request. A
        // fraction below 1 keeps it in the upload phase, so no time-based ramp is started here.
        @params.UploadProgressHandler!(0.5f, 0);
        // ReSharper disable once AccessToModifiedClosure
        observedUpload.Add(uploader.CurrentProgress!.Value.Upload);

        return Task.FromResult(new Screenshot { Id = "1" });
      }
    };

    uploader = ScreenshotUploaderTests.MakeUploader(api);

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    // Mid-upload the handler's 0.5 fraction was visible through CurrentProgress...
    Assert.Equal(0.5f, Assert.Single(observedUpload));

    // ...and the successful completion then drove it to fully complete.
    Assert.True(uploader.CurrentProgress!.Value.IsComplete);
  }

  [Fact]
  public async Task Reset_ClearsCurrentProgress() {
    var api = new FakeApi {
      UploadScreenshotImpl = _ => Task.FromResult(new Screenshot { Id = "1" })
    };

    var uploader = ScreenshotUploaderTests.MakeUploader(api);

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.NotNull(uploader.CurrentProgress);

    uploader.Reset();

    Assert.Null(uploader.CurrentProgress);
  }

  private static ScreenshotUploader MakeUploader(
    IHallOfFameApi api,
    Action<HttpException>? reportError = null,
    IModLog? log = null
  ) =>
    new(api, log ?? new FakeModLog(), reportError ?? (_ => { }));

  private static ScreenshotSnapshot MakeSnapshot(
    int achievedMilestone = 0,
    int population = 0,
    string? mapName = null,
    byte[]? imageBytes = null,
    IDictionary<string, float>? renderSettings = null,
    string[]? modIds = null
  ) =>
    new(
      achievedMilestone,
      population,
      mapName,
      imageBytes ?? [],
      0,
      0,
      false,
      false,
      renderSettings ?? new Dictionary<string, float>(),
      modIds ?? []
    );

  private static ScreenshotInfoFormValue MakeForm(
    bool shareModIds = false,
    bool shareRenderSettings = false,
    string? showcasedModId = null,
    string? description = null
  ) =>
    new() {
      ShareModIds = shareModIds,
      ShareRenderSettings = shareRenderSettings,
      ShowcasedModId = showcasedModId,
      Description = description
    };
}
