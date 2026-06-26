using System;
using Colossal.UI.Binding;

namespace HallOfFame.Services;

/// <summary>
/// Pure state machine driving the screenshot upload progress shown in the UI.
/// The shell (the capture system) owns the clock, the timer loop, and cancellation; this model owns
/// only the state and the "ticks to progress" math, which is what makes it unit-testable
/// off-engine.
/// "No active progress" is represented by the shell holding a <c>null</c> model, not by an extra
/// state here, hence there is no reset.
/// </summary>
internal sealed class UploadProgressModel {
  /// <summary>
  /// Duration over which the processing progress ramps up to its cap, in seconds.
  /// The server does not stream back processing progress, so it is a time-based guess.
  /// </summary>
  private const float ProcessingTimeSeconds = 8f;

  /// <summary>
  /// Maximum value the processing progress guess is allowed to reach before the server actually
  /// responds, so we never display "almost done" prematurely.
  /// </summary>
  private const float MaxProcessingProgress = .9f;

  /// <summary>
  /// Whether the upload has finished, and we are now waiting on (and guessing) server-side
  /// processing.
  /// Becomes <c>true</c> the first time the upload fraction reaches 1 and never reverts.
  /// </summary>
  internal bool IsProcessing { get; private set; }

  /// <summary>
  /// Whether the processing progress guess has reached its cap, i.e., the ramp has nothing left to
  /// do, and the shell's timer loop can stop by itself (it is also stopped on completion or error).
  /// </summary>
  internal bool HasReachedProcessingCap =>
    this.Current.Processing >= UploadProgressModel.MaxProcessingProgress;

  /// <summary>
  /// Current progress snapshot, starting at <c>(0, 0)</c>.
  /// </summary>
  internal UploadProgress Current { get; private set; } = new(0, 0);

  /// <summary>
  /// Reports the upload fraction (0 to 1) as the request body is sent.
  /// The first time it reaches 1, processing starts; later calls with a fraction >= 1 are no-ops,
  /// so the processing ramp is not reset (UnityWebRequest keeps firing the callback with
  /// upload == 1).
  /// </summary>
  internal void ReportUploadProgress(float uploadFraction) {
    if (uploadFraction < 1) {
      this.Current = new UploadProgress(uploadFraction, 0);

      return;
    }

    if (this.IsProcessing) {
      return;
    }

    this.IsProcessing = true;
    this.Current = new UploadProgress(1, 0);
  }

  /// <summary>
  /// Reports the time elapsed since processing started, ramping the processing progress linearly up
  /// to its cap.
  /// Ordering contract: this must be called only after <see cref="IsProcessing"/> is <c>true</c>; a
  /// stray earlier tick is leniently ignored so it cannot corrupt state mid-upload.
  /// </summary>
  internal void ReportProcessingElapsed(float elapsedSeconds) {
    if (!this.IsProcessing) {
      return;
    }

    var processing = Math.Min(
      elapsedSeconds / UploadProgressModel.ProcessingTimeSeconds,
      UploadProgressModel.MaxProcessingProgress
    );

    this.Current = new UploadProgress(1, processing);
  }

  /// <summary>
  /// Marks the whole upload as fully complete <c>(1, 1)</c>.
  /// </summary>
  internal void Complete() {
    this.Current = new UploadProgress(1, 1);
  }
}

/// <summary>
/// Immutable progress snapshot for a screenshot upload, serializable to JSON for the UI.
/// This is a local UI view-model, never exchanged with the server; hence it lives in Services and
/// not in Domain.
/// </summary>
internal readonly struct UploadProgress(
  float upload,
  float processing
) : IJsonWritable {
  /// <summary>
  /// Upload fraction, from 0 (not started) to 1 (request body fully sent).
  /// </summary>
  internal float Upload { get; } = upload;

  /// <summary>
  /// Processing fraction, from 0 to 1, guessed from elapsed time until the server responds.
  /// </summary>
  internal float Processing { get; } = processing;

  /// <summary>
  /// Whether both phases are fully done.
  /// </summary>
  internal bool IsComplete => this.Upload >= 1 && this.Processing >= 1;

  /// <summary>
  /// Combined progress across both phases, from 0 to 1.
  /// </summary>
  internal float GlobalProgress => (this.Upload + this.Processing) / 2;

  public void Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("isComplete");
    writer.Write(this.IsComplete);

    writer.PropertyName("globalProgress");
    writer.Write(this.GlobalProgress);

    writer.PropertyName("uploadProgress");
    writer.Write(this.Upload);

    writer.PropertyName("processingProgress");
    writer.Write(this.Processing);

    writer.TypeEnd();
  }
}
