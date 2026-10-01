using System;
using System.Globalization;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Colossal.Json;
using Game;
using Game.SceneFlow;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal sealed partial class HttpQueries : IHallOfFameApi {
  private const string BaseApiPath = "/api/v1";

  /// <summary>
  /// Wall-clock budget for an API call, in seconds.
  /// Unity defaults to none, which leaves a stalled connection never completing and the awaiting
  /// caller hung with no error, since the error policy only runs on a thrown result.
  /// </summary>
  internal const int RequestTimeoutSeconds = 30;

  /// <summary>
  /// Wall-clock budget for a request that moves an image rather than metadata.
  /// Unity's timeout caps the whole exchange rather than its idle time, so a transfer needs a
  /// budget loose enough not to cancel one that is merely slow: a 4K image on a modest connection
  /// legitimately runs past the budget a metadata call gets.
  /// </summary>
  private const int TransferTimeoutSeconds = 300;

  /// <summary>
  /// No wall-clock budget, for the one request whose duration cannot be predicted: a screenshot
  /// upload is of unbounded size, so any budget would abort a legitimate slow upload.
  /// This is deliberate, and the trade is that the request can hang. It is the safe side to err on
  /// here: an aborted upload the server had already begun committing would be republished by the
  /// user's retry, and a hang holds no lock and shows as a stalled progress bar.
  /// </summary>
  private const int NoTimeout = 0;

  private static ushort lastRequestId;

  /// <summary>
  /// Weak table that maps UnityWebRequest instances to request IDs for tracking requests in logs.
  /// The value has to be a reference type, so we use a string where we serialize
  /// `++<see cref="lastRequestId"/>`.
  /// </summary>
  private static readonly ConditionalWeakTable<UnityWebRequest, string>
    RequestIdsMap = new();

  internal static string PrependApiUrl(string path) =>
    $"{Mod.Settings.BaseUrlWithScheme}{HttpQueries.BaseApiPath}{path}";

  /// <summary>
  /// Returns the tracking request ID assigned to <paramref name="request"/> in
  /// <see cref="RequestIdsMap"/>, or "?" when none was recorded.
  /// </summary>
  private static string GetRequestId(UnityWebRequest request) {
    HttpQueries.RequestIdsMap.TryGetValue(request, out var requestId);

    return requestId ?? "?";
  }

  private static async Task SendRequest(
    UnityWebRequest request,
    int timeoutSeconds,
    ProgressHandler? progressHandler = null,
    bool withModHeaders = true
  ) {
    // When using directly the UnityWebRequest constructor directly, for example, when making POST
    // requests with an empty body, the download handler is not set, which prevents us from reading
    // the response.
    request.downloadHandler ??= new DownloadHandlerBuffer();

    request.timeout = timeoutSeconds;

    if (withModHeaders) {
      HttpQueries.AddModHeaders(request);
    }

    var requestId = (++HttpQueries.lastRequestId).ToString();

    HttpQueries.RequestIdsMap.Add(request, requestId);

    Mod.Log.Verbose($"HTTP: Sending request #{requestId} {request.method} {request.url}");

    // Polling rather than awaiting the operation, to avoid Game's UnityWebRequestAwaiter: it
    // subscribes to `completed` in its constructor and fires again inline from `OnCompleted`, with
    // neither an unsubscribe nor an already-invoked guard, so it can resume the caller twice, and
    // the second resume throws out of Unity's completion pump where no mod code can catch it.
    // Holding the operation in a local also keeps it from being finalized while in flight.
    var operation = request.SendWebRequest();

    var uploadProgress = -1f;
    var downloadProgress = -1f;

    while (!operation.isDone) {
      // ReSharper disable CompareOfFloatsByEqualityOperator
      // We don't derive floats from any calculations so this is fine.
      if (
        progressHandler is not null &&
        (uploadProgress != request.uploadProgress ||
          downloadProgress != request.downloadProgress)) {
        uploadProgress = request.uploadProgress;
        downloadProgress = request.downloadProgress;

        progressHandler(uploadProgress, downloadProgress);
      }

      // ReSharper restore CompareOfFloatsByEqualityOperator

      // 1. We execute this Task on the main thread, so we *need* to yield to the main thread to
      //    let it do its work.
      // 2. No need to update continuously, so even if this was in the thread pool, we can wait
      //    some time between updates.
      await Task.Yield();
    }

    progressHandler?.Invoke(1f, 1f);

    Mod.Log.Verbose($"HTTP: Request #{requestId} completed ({request.responseCode}).");
  }

  /// <summary>
  /// Sends a request expecting a JSON body, then parses and status-maps it into
  /// <typeparamref name="T"/> (see <see cref="ParseResponse{T}"/>).
  /// </summary>
  private static async Task<T> Send<T>(
    UnityWebRequest request,
    ProgressHandler? progressHandler = null,
    int timeoutSeconds = HttpQueries.RequestTimeoutSeconds
  ) where T : new() {
    await HttpQueries.SendRequest(request, timeoutSeconds, progressHandler);

    return HttpQueries.ParseResponse<T>(request);
  }

  /// <summary>
  /// Sends a request expecting a raw binary body (e.g., a CDN image) and returns the downloaded
  /// bytes.
  /// Unlike <see cref="Send{T}"/>, this applies no JSON status mapping: any non-success result is
  /// logged and rethrown as a <see cref="HttpNetworkException"/>.
  /// </summary>
  private static async Task<byte[]> SendForBytes(UnityWebRequest request) {
    await HttpQueries.SendRequest(request, HttpQueries.TransferTimeoutSeconds);

    if (request.result is UnityWebRequest.Result.Success) {
      return request.downloadHandler.data;
    }

    // The verbose send/complete tracing may be disabled at the default log level, so the failing
    // URL has to stay in this always-on error line.
    // The body is capped because an aborted transfer leaves a partial one: a CDN error page is
    // worth reading, several megabytes of half-downloaded image are not.
    var body = request.downloadHandler.text;

    Mod.Log.ErrorSilent(
      $"HTTP: Downloading {request.url} failed ({request.responseCode}): " +
      (string.IsNullOrEmpty(body)
        ? request.error
        : body.Substring(0, Math.Min(body.Length, 500)))
    );

    throw new HttpNetworkException(HttpQueries.GetRequestId(request), request.error);
  }

  /// <summary>
  /// Sends a request and returns its final URL after any redirects (the request is typically a HEAD
  /// whose only purpose is to follow the redirect chain).
  /// A non-success result is thrown as a <see cref="HttpNetworkException"/>.
  /// <para>
  /// The mod headers are deliberately withheld: the engine follows the chain in native code, which
  /// would replay them onto the third-party host the chain ends on, and these carry the creator
  /// credential. Nothing is lost by withholding them, as the endpoint resolves a creator by public
  /// name and does not authenticate.
  /// </para>
  /// </summary>
  private static async Task<string> SendForRedirect(UnityWebRequest request) {
    await HttpQueries.SendRequest(
      request,
      HttpQueries.RequestTimeoutSeconds,
      withModHeaders: false
    );

    if (request.result is not UnityWebRequest.Result.Success) {
      throw new HttpNetworkException(
        HttpQueries.GetRequestId(request),
        $"Error resolving link to creator page: {request.responseCode} {request.error}."
      );
    }

    return request.url;
  }

  /// <summary>
  /// Attaches the mod's headers, the creator credential among them, to a request bound for our own
  /// API.
  /// The whole origin is checked and not just the path, because these headers carry an API
  /// credential and several requests take a URL the server supplies (a CDN image, a social link):
  /// a path-only check would hand the credential to any other host serving a
  /// <see cref="BaseApiPath"/> path, and a host-only check would hand it to a cleartext scheme on
  /// our own host.
  /// </summary>
  private static void AddModHeaders(UnityWebRequest request) {
    var apiUri = new Uri(HttpQueries.PrependApiUrl("/"));

    // Comparing the parsed base rather than the raw setting, so a trailing slash on it cannot shift
    // the prefix this is matched against.
    var isOurApi =
      request.uri.Scheme == apiUri.Scheme &&
      request.uri.Port == apiUri.Port &&
      string.Equals(request.uri.Host, apiUri.Host, StringComparison.OrdinalIgnoreCase) &&
      request.uri.AbsolutePath.StartsWith(apiUri.AbsolutePath.TrimEnd('/'));

    if (!isOurApi) {
      return;
    }

    request.SetRequestHeader(
      "Authorization",
      Mod.CreatorIdentity.BuildAuthorizationHeader()
    );

    request.SetRequestHeader(
      "Accept-Language",
      GameManager.instance.localizationManager.activeLocaleId
    );

    request.SetRequestHeader(
      "X-Timezone-Offset",
      TimeZoneInfo.Local
        .GetUtcOffset(DateTime.Now)
        // For some reason `.Minutes` (int of full minutes) is always 0.
        // But UTC offsets are always full minutes, so this is fine.
        .TotalMinutes
        .ToString(CultureInfo.InvariantCulture)
    );
  }

  private static T ParseResponse<T>(UnityWebRequest request) where T : new() {
    var requestId = HttpQueries.GetRequestId(request);

    if (!request.isDone) {
      throw new InvalidOperationException($"Request #{requestId} is not done.");
    }

    try {
      // First, handle classical pure network errors (ex. no internet, host unreachable, etc.).
      // ReSharper disable once ConvertIfStatementToSwitchStatement
      if (request.result
        is UnityWebRequest.Result.ConnectionError or UnityWebRequest.Result.DataProcessingError) {
        throw new HttpNetworkException(requestId, request.error);
      }

      // Unity's client is high-level and interprets non-2xx status codes as "protocol errors".
      // ReSharper disable once InvertIf
      if (request.result is UnityWebRequest.Result.ProtocolError) {
        var error = HttpQueries.ParseResponseJson<JsonError>(request);

        throw request.responseCode switch {
          >= 500 =>
            new HttpServerException(requestId, error),
          >= 400 and not 404 =>
            new HttpUserException(requestId, error),
          404 =>
            new HttpUserCompatibilityException(requestId, error),

          // This should not happen.
          _ => new HttpNetworkException(requestId, error.Message)
        };
      }

      // So far so good, we can parse the JSON response.
      // This will throw if the JSON is invalid, our job here is done.
      return HttpQueries.ParseResponseJson<T>(request);
    }
    catch (Exception ex) {
      // If this is a network error (or else), log as-is.
      if (request.result is not UnityWebRequest.Result.ProtocolError) {
        Mod.Log.ErrorSilent(
          ex,
          $"HTTP: Error sending request #{requestId}."
        );
      }

      // If this is an HTTP error, log the response body as well.
      if (request.result is UnityWebRequest.Result.ProtocolError) {
        Mod.Log.ErrorSilent(
          $"HTTP: Error response {request.responseCode} " +
          $"for request #{requestId}: {request.downloadHandler.text}"
        );
      }

      throw;
    }
  }

  private static T ParseResponseJson<T>(UnityWebRequest request)
    where T : new() {
    var requestId = HttpQueries.GetRequestId(request);

    var json = request.downloadHandler.text;

    try {
      if (string.IsNullOrWhiteSpace(json)) {
        throw new Exception("Empty body response.");
      }

      // This may throw if the JSON is invalid, but there is a wide range of exceptions that can be
      // thrown here, so we will catch them all and interpret them as a parsing error.
      var variant = JSON.Load(json);

      // Colossal's JSON library does always throw an exception when parsing invalid JSON, so we
      // need to check for null here.
      // It's kinda inconsistent, for example, parsing `foo` (not valid JSON) yields null, but
      // parsing `{foo: "bar"}` would throw a `JSONFormatUnexpectedEndException`.
      if (variant is null) {
        throw new Exception("Response is not valid JSON.");
      }

      // This may throw various exception, like with `JSON.Load()` we will handle any Exception as a
      // parsing error.
      return variant.Make<T>();
    }
    catch (Exception ex) {
      throw new HttpNetworkException(
        requestId,
        $"Failed to parse JSON response into {typeof(T).FullName}: " +
        ex.Message,
        ex
      );
    }
  }

  internal class JsonError {
    [DecodeAlias("message")]
    public string Message { get; private set; } = "Unknown error.";
  }
}
