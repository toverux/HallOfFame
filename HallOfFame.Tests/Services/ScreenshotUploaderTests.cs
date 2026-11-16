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
  public async Task Upload_Success_LeavesCurrentProgressComplete_AndHoldsTheUploadedId() {
    var api = new FakeApi {
      UploadScreenshotImpl = _ => Task.FromResult(
        new Screenshot {
          Id = "42"
        }
      )
    };

    var uploader = ScreenshotUploaderTests.MakeUploader(api);

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.True(uploader.CurrentProgress!.Value.IsComplete);
    Assert.Equal("42", uploader.UploadedScreenshotId);
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

    var uploader = ScreenshotUploaderTests.MakeUploader(
      api,
      reported.Add,
      new FakeModLog {
        ErrorRecoverableImpl = logged.Add
      }
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

        return Task.FromResult(
          new Screenshot {
            Id = "1"
          }
        );
      }
    };

    var uploader = ScreenshotUploaderTests.MakeUploader(api);

    var imageBytes = new byte[] { 1, 2, 3 };
    var renderSettings = new Dictionary<string, float> {
      ["bloom"] = 1.5f
    };
    var modIds = new[] { "mod.a", "mod.b" };
    var renderConditions = new Dictionary<string, object> {
      ["time.hour"] = 14.5f,
      ["climate.season"] = "Summer",
      ["options.dayNightVisuals"] = true
    };

    var snapshot = ScreenshotUploaderTests.MakeSnapshot(
      achievedMilestone: 7,
      population: 12345,
      mapName: "Map A",
      imageBytes: Task.FromResult(imageBytes),
      renderSettings: renderSettings,
      renderConditions: renderConditions,
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
    Assert.Same(renderConditions, sent.RenderConditions);
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

        return Task.FromResult(
          new Screenshot {
            Id = "1"
          }
        );
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
      UploadScreenshotImpl = _ => Task.FromResult(
        new Screenshot {
          Id = "1"
        }
      )
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

  [Fact]
  public async Task Upload_AbandonedOneLandingLast_LeavesTheNewerUploadedId() {
    var abandoned = new TaskCompletionSource<Screenshot>();
    var answers = new Queue<Task<Screenshot>>(
      [
        abandoned.Task,
        Task.FromResult(
          new Screenshot {
            Id = "new"
          }
        )
      ]
    );

    var api = new FakeApi {
      UploadScreenshotImpl = _ => answers.Dequeue()
    };

    var tracked = new List<string>();
    var uploader = ScreenshotUploaderTests.MakeUploader(api, tracked: tracked);

    var first = uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    uploader.Reset();

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    abandoned.SetResult(
      new Screenshot {
        Id = "old"
      }
    );
    await first;

    Assert.Equal("new", uploader.UploadedScreenshotId);

    // Each upload reports its own outcome, the newer one landing first.
    Assert.Equal(["stored", "stored"], tracked);
  }

  [Fact]
  public async Task Upload_AbandonedOneFailingDuringANewerOne_LeavesTheNewerOneAlone() {
    var abandoned = new TaskCompletionSource<Screenshot>();
    var answers = new Queue<Task<Screenshot>>(
      [
        abandoned.Task,
        Task.FromResult(
          new Screenshot {
            Id = "new"
          }
        )
      ]
    );

    var api = new FakeApi {
      UploadScreenshotImpl = _ => answers.Dequeue()
    };

    var reported = new List<HttpException>();
    var tracked = new List<string>();

    var uploader = ScreenshotUploaderTests.MakeUploader(
      api,
      reportError: reported.Add,
      tracked: tracked
    );

    var first = uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    uploader.Reset();

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    abandoned.SetException(new HttpNetworkException("1", "boom"));
    await first;

    Assert.Equal("new", uploader.UploadedScreenshotId);
    Assert.NotNull(uploader.CurrentProgress);
    Assert.Empty(reported);

    // The abandoned upload reports its failure through usage alone, never to the player.
    Assert.Equal(["stored", "network"], tracked);
  }

  [Fact]
  public async Task Upload_FailingAfterAResetWithNoNewerUpload_StillReportsTheError() {
    var pending = new TaskCompletionSource<Screenshot>();

    var api = new FakeApi {
      UploadScreenshotImpl = _ => pending.Task
    };

    var reported = new List<HttpException>();
    var uploader = ScreenshotUploaderTests.MakeUploader(api, reportError: reported.Add);

    var upload = uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    uploader.Reset();

    pending.SetException(new HttpNetworkException("1", "boom"));
    await upload;

    Assert.IsType<HttpNetworkException>(Assert.Single(reported));
  }

  /// <summary>
  /// The upload panel opens on the preview while the full image still encodes, so an upload can
  /// start before the image bytes exist.
  /// </summary>
  [Fact]
  public async Task Upload_PendingImage_CallsTheApiOnceTheImageIsEncoded() {
    var encoded = new TaskCompletionSource<byte[]>();
    var imageBytes = new byte[] { 1, 2, 3 };

    byte[]? sentBytes = null;

    var api = new FakeApi {
      UploadScreenshotImpl = @params => {
        sentBytes = @params.ScreenshotData;

        return Task.FromResult(
          new Screenshot {
            Id = "1"
          }
        );
      }
    };

    var uploader = ScreenshotUploaderTests.MakeUploader(api);

    var upload = uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(imageBytes: encoded.Task),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.Null(sentBytes);
    Assert.False(uploader.CurrentProgress!.Value.IsComplete);

    encoded.SetResult(imageBytes);
    await upload;

    Assert.Same(imageBytes, sentBytes);
    Assert.True(uploader.CurrentProgress!.Value.IsComplete);
  }

  /// <summary>
  /// The capture reports a failed encode and closes the panel, so the upload stops without an error
  /// of its own, which would show a second dialog.
  /// </summary>
  [Fact]
  public async Task Upload_FailedEncode_NeverCallsTheApi_AndReportsNothing() {
    var isApiCalled = false;

    var api = new FakeApi {
      UploadScreenshotImpl = _ => {
        isApiCalled = true;

        return Task.FromResult(
          new Screenshot {
            Id = "1"
          }
        );
      }
    };

    var recoverable = new List<Exception>();
    var reported = new List<HttpException>();

    var uploader = ScreenshotUploaderTests.MakeUploader(
      api,
      reported.Add,
      new FakeModLog {
        ErrorRecoverableImpl = recoverable.Add
      }
    );

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(
        imageBytes: Task.FromException<byte[]>(new InvalidOperationException("boom"))
      ),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.False(isApiCalled);
    Assert.Empty(recoverable);
    Assert.Empty(reported);
    Assert.Null(uploader.CurrentProgress);
  }

  [Fact]
  public async Task Upload_Success_TracksStored() {
    var api = new FakeApi {
      UploadScreenshotImpl = _ => Task.FromResult(
        new Screenshot {
          Id = "1"
        }
      )
    };

    var tracked = new List<string>();
    var uploader = ScreenshotUploaderTests.MakeUploader(api, tracked: tracked);

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.Equal(["stored"], tracked);
  }

  [Theory]
  [InlineData("network")]
  [InlineData("bad_response")]
  [InlineData("rejected")]
  [InlineData("incompatible")]
  [InlineData("server_error")]
  [InlineData("failed")]
  public async Task Upload_Failure_TracksItsOutcome(string outcome) {
    var api = new FakeApi {
      UploadScreenshotImpl = _ =>
        Task.FromException<Screenshot>(ScreenshotUploaderTests.MakeFailure(outcome))
    };

    var tracked = new List<string>();
    var uploader = ScreenshotUploaderTests.MakeUploader(api, tracked: tracked);

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.Equal([outcome], tracked);
  }

  [Fact]
  public async Task Upload_FailedEncode_TracksEncodeFailed() {
    var tracked = new List<string>();
    var uploader = ScreenshotUploaderTests.MakeUploader(new FakeApi(), tracked: tracked);

    await uploader.Upload(
      ScreenshotUploaderTests.MakeSnapshot(
        imageBytes: Task.FromException<byte[]>(new InvalidOperationException("boom"))
      ),
      "City",
      ScreenshotUploaderTests.MakeForm()
    );

    Assert.Equal(["encode_failed"], tracked);
  }

  /// <summary>
  /// The exception an upload ending on <paramref name="outcome"/> fails with, as the HTTP layer
  /// raises it.
  /// </summary>
  private static Exception MakeFailure(string outcome) =>
    outcome switch {
      "network" => new HttpNetworkException("1", "boom"),
      "bad_response" => new HttpNetworkException("1", "boom") {
        IsUndecodable = true
      },
      "rejected" => new HttpUserException("1", new HttpQueries.JsonError()),
      "incompatible" => new HttpUserCompatibilityException("1", new HttpQueries.JsonError()),
      "server_error" => new HttpServerException("1", new HttpQueries.JsonError()),
      _ => new InvalidOperationException("boom")
    };

  private static ScreenshotUploader MakeUploader(
    IHallOfFameApi api,
    Action<HttpException>? reportError = null,
    IModLog? log = null,
    List<string>? tracked = null
  ) =>
    new(
      api,
      log ?? new FakeModLog(),
      reportError ?? (_ => {}),
      (name, properties) => ScreenshotUploaderTests.RecordOutcome(tracked, name, properties)
    );

  /// <summary>
  /// Records the outcome of each <c>upload_finished</c>, failing on any other event, so a test
  /// asserts the exits of an upload as a list of outcomes.
  /// </summary>
  private static void RecordOutcome(
    List<string>? tracked,
    string name,
    Dictionary<string, object>? properties
  ) {
    Assert.Equal("upload_finished", name);
    Assert.NotNull(properties);

    tracked?.Add((string) Assert.Single(properties!, p => p.Key == "outcome").Value);
  }

  private static ScreenshotSnapshot MakeSnapshot(
    int achievedMilestone = 0,
    int population = 0,
    string? mapName = null,
    Task<byte[]>? imageBytes = null,
    IDictionary<string, float>? renderSettings = null,
    IReadOnlyDictionary<string, object>? renderConditions = null,
    string[]? modIds = null
  ) =>
    new(
      achievedMilestone,
      population,
      mapName,
      imageBytes ?? Task.FromResult<byte[]>([]),
      0,
      0,
      false,
      renderSettings ?? new Dictionary<string, float>(),
      renderConditions ?? new Dictionary<string, object>(),
      modIds ?? []
    );

  private static ScreenshotInfoFormValue MakeForm(
    bool shareModIds = false,
    bool shareRenderSettings = false,
    string? showcasedModId = null,
    string description = ""
  ) =>
    new() {
      ShareModIds = shareModIds,
      ShareRenderSettings = shareRenderSettings,
      ShowcasedModId = showcasedModId,
      Description = description
    };
}
