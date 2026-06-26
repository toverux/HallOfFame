namespace HallOfFame.Http;

/// <summary>
/// Callback reporting the upload and download progress of an in-flight request, each value a ratio
/// in the [0, 1] range.
/// </summary>
internal delegate void ProgressHandler(
  float uploadProgress,
  float downloadProgress
);
