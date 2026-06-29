using System;
using System.Threading;
using System.Threading.Tasks;
using HallOfFame.Http;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Owns the screenshot upload workflow: it merges the frozen <see cref="ScreenshotSnapshot"/>, the
/// live city name, and the user's <see cref="ScreenshotInfoFormValue"/> into a single upload
/// request, drives the two-phase progress (network upload, then a time-based processing guess), and
/// reports the outcome.
/// </summary>
internal sealed class ScreenshotUploader(
  IHallOfFameApi api,
  IModLog log,
  Action<HttpException> reportError
) {
  /// <summary>
  /// Progress model for the current upload, or <c>null</c> when no upload is in progress.
  /// The UI polls it through <see cref="CurrentProgress"/>; a concurrent <see cref="Reset"/> (e.g.,
  /// the screenshot being cleared mid-upload) nulls this field while the in-flight upload keeps
  /// driving its own captured local instance harmlessly.
  /// </summary>
  private UploadProgressModel? currentModel;

  /// <summary>
  /// Current upload progress snapshot read back by the UI, or <c>null</c> when no upload is in
  /// progress.
  /// </summary>
  internal UploadProgress? CurrentProgress => this.currentModel?.Current;

  /// <summary>
  /// Clears the current upload progress, so the UI stops showing it.
  /// Nulls only the field; an in-flight upload keeps driving its own captured model, see
  /// <see cref="currentModel"/>.
  /// </summary>
  internal void Reset() {
    this.currentModel = null;
  }

  /// <summary>
  /// Uploads a screenshot, merging the frozen <paramref name="snapshot"/>, the live
  /// <paramref name="cityName"/> (deliberately read by the caller at call time, not frozen in the
  /// snapshot), and the user's <paramref name="form"/> input.
  /// Designed never to throw, so the caller can fire-and-forget it: an <see cref="HttpException"/>
  /// goes to <see cref="reportError"/>, any other error is logged as recoverable, and either way
  /// the progress is reset.
  /// </summary>
  internal async Task Upload(
    ScreenshotSnapshot snapshot,
    string cityName,
    ScreenshotInfoFormValue form
  ) {
    CancellationTokenSource? processingUpdatesCts = null;

    // Capture a non-null reference to this upload's model: the field can be cleared concurrently
    // (e.g., by clearing the screenshot), but the callback and the ramp must keep driving this same
    // instance, which the UI binding reads back through the field.
    var progressModel = this.currentModel = new UploadProgressModel();

    try {
      var screenshot = await api.UploadScreenshot(
        new UploadScreenshotParams {
          CityName = cityName,
          CityMilestone = snapshot.AchievedMilestone,
          CityPopulation = snapshot.Population,
          MapName = snapshot.MapName,
          ShowcasedModId = form.ShowcasedModId,
          Description = form.Description,
          ShareModIds = form.ShareModIds,
          ModIds = snapshot.ModIds,
          ShareRenderSettings = form.ShareRenderSettings,
          RenderSettings = snapshot.RenderSettings,
          ScreenshotData = snapshot.ImageBytes,
          UploadProgressHandler = (upload, download) => {
            progressModel.ReportUploadProgress(upload);

            // Once the request body is fully sent, start the time-based processing progress ramp.
            // The guard ensures it is started only once, as the callback keeps firing afterward.
            if (progressModel.IsProcessing && processingUpdatesCts is null) {
              processingUpdatesCts = new CancellationTokenSource();

              _ = StartUpdateProcessingProgress(processingUpdatesCts.Token);
            }
          }
        }
      );

      progressModel.Complete();

      log.Info($"{nameof(ScreenshotUploader)}: Screenshot uploaded, ID #{screenshot.Id}.");
    }
    catch (HttpException ex) {
      // Reset progress state.
      this.currentModel = null;

      reportError(ex);
    }
    catch (Exception ex) {
      // Reset progress state.
      this.currentModel = null;

      log.ErrorRecoverable(ex);
    }
    finally {
      processingUpdatesCts?.Cancel();
    }

    return;

    async Task StartUpdateProcessingProgress(CancellationToken ct) {
      var startTime = DateTime.Now;

      while (!ct.IsCancellationRequested) {
        var elapsedSeconds = (float)(DateTime.Now - startTime).TotalSeconds;

        progressModel.ReportProcessingElapsed(elapsedSeconds);

        // The model caps the processing guess; once reached, the ramp has nothing left to do and
        // stops by itself (it is also canceled when the upload completes or errors).
        if (progressModel.HasReachedProcessingCap) {
          break;
        }

        await Task.Yield();
      }
    }
  }
}
