using HallOfFame.Services;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class UploadProgressModelTests {
  /// <summary>
  /// Tolerance for the floating-point progress comparisons.
  /// </summary>
  private const double Tolerance = 1e-5;

  [Fact]
  public void Initial_IsZero_NotProcessing_NotComplete() {
    var model = new UploadProgressModel();

    Assert.Equal(0, model.Current.Upload, UploadProgressModelTests.Tolerance);
    Assert.Equal(0, model.Current.Processing, UploadProgressModelTests.Tolerance);
    Assert.Equal(0, model.Current.GlobalProgress, UploadProgressModelTests.Tolerance);
    Assert.False(model.IsProcessing);
    Assert.False(model.Current.IsComplete);
  }

  [Fact]
  public void ReportUploadProgress_BelowOne_UpdatesUploadOnly() {
    var model = new UploadProgressModel();

    model.ReportUploadProgress(0.5f);

    Assert.Equal(0.5, model.Current.Upload, UploadProgressModelTests.Tolerance);
    Assert.Equal(0, model.Current.Processing, UploadProgressModelTests.Tolerance);
    Assert.Equal(0.25, model.Current.GlobalProgress, UploadProgressModelTests.Tolerance);
    Assert.False(model.IsProcessing);
  }

  [Fact]
  public void ReportUploadProgress_ReachingOne_StartsProcessing() {
    var model = new UploadProgressModel();

    model.ReportUploadProgress(1f);

    Assert.Equal(1, model.Current.Upload, UploadProgressModelTests.Tolerance);
    Assert.Equal(0, model.Current.Processing, UploadProgressModelTests.Tolerance);
    Assert.True(model.IsProcessing);
  }

  /// <summary>
  /// The load-bearing case: UnityWebRequest keeps firing the callback with <c>upload == 1</c>, and
  /// a late report must not rewind the processing ramp that already started.
  /// </summary>
  [Fact]
  public void ReportUploadProgress_AfterProcessingStarted_DoesNotResetProcessing() {
    var model = new UploadProgressModel();

    model.ReportUploadProgress(1f);
    model.ReportProcessingElapsed(4f);

    model.ReportUploadProgress(1f);

    Assert.Equal(1, model.Current.Upload, UploadProgressModelTests.Tolerance);
    Assert.Equal(0.5, model.Current.Processing, UploadProgressModelTests.Tolerance);
    Assert.True(model.IsProcessing);
  }

  [Fact]
  public void ReportProcessingElapsed_RampsLinearly() {
    var model = new UploadProgressModel();

    model.ReportUploadProgress(1f);
    model.ReportProcessingElapsed(4f);

    Assert.Equal(1, model.Current.Upload, UploadProgressModelTests.Tolerance);
    Assert.Equal(0.5, model.Current.Processing, UploadProgressModelTests.Tolerance);
    Assert.Equal(0.75, model.Current.GlobalProgress, UploadProgressModelTests.Tolerance);
  }

  [Fact]
  public void ReportProcessingElapsed_CapsAt90Percent() {
    var model = new UploadProgressModel();

    model.ReportUploadProgress(1f);

    model.ReportProcessingElapsed(8f);
    Assert.Equal(0.9, model.Current.Processing, UploadProgressModelTests.Tolerance);

    model.ReportProcessingElapsed(100f);
    Assert.Equal(0.9, model.Current.Processing, UploadProgressModelTests.Tolerance);

    Assert.True(model.HasReachedProcessingCap);
  }

  [Fact]
  public void Complete_SetsFull_AndIsComplete() {
    var model = new UploadProgressModel();

    model.Complete();

    Assert.Equal(1, model.Current.Upload, UploadProgressModelTests.Tolerance);
    Assert.Equal(1, model.Current.Processing, UploadProgressModelTests.Tolerance);
    Assert.Equal(1, model.Current.GlobalProgress, UploadProgressModelTests.Tolerance);
    Assert.True(model.Current.IsComplete);
  }

  /// <summary>
  /// Ordering contract: a processing tick before the upload reaches 1 is leniently ignored so it
  /// cannot corrupt state mid-upload.
  /// </summary>
  [Fact]
  public void ReportProcessingElapsed_BeforeProcessing_IsNoOp() {
    var model = new UploadProgressModel();

    model.ReportProcessingElapsed(4f);

    Assert.Equal(0, model.Current.Upload, UploadProgressModelTests.Tolerance);
    Assert.Equal(0, model.Current.Processing, UploadProgressModelTests.Tolerance);
    Assert.False(model.IsProcessing);
  }
}
