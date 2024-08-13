using System;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Colossal.Json;
using Game;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    internal delegate void ProgressHandler(
        float uploadProgress,
        float downloadProgress);

    private static ushort lastRequestId;

    /// <summary>
    /// Weak table that maps UnityWebRequest instances to request IDs for
    /// tracking requests in logs.
    /// The value has to be a reference type, so we use a string where we
    /// serialize `++<see cref="lastRequestId"/>`.
    /// </summary>
    private static readonly ConditionalWeakTable<UnityWebRequest, string>
        RequestIdsMap = new();

    private static string PrependBaseUrl(string path) {
        var baseUrl = Mod.Settings.BaseUrl.StartsWith("http")
            ? Mod.Settings.BaseUrl
            : $"https://{Mod.Settings.BaseUrl}";

        return $"{baseUrl}{path}";
    }

    private static void AddAuthorizationHeader(UnityWebRequest request) {
        if (!string.IsNullOrWhiteSpace(Settings.CreatorID)) {
            request.SetRequestHeader(
                "Authorization",
                $"CreatorID {Settings.CreatorID}");
        }
    }

    private static async Task SendRequest(
        UnityWebRequest request,
        ProgressHandler? progressHandler = null) {
        var requestId = (++HttpQueries.lastRequestId).ToString();

        HttpQueries.RequestIdsMap.Add(request, requestId);

        Mod.Log.Info($"HTTP: Sending request #{requestId} to {request.url}.");

        Task? trackerTask = null;

        if (progressHandler is not null) {
            trackerTask = TrackRequestProgress();
        }

        await request.SendWebRequest();

        if (trackerTask is not null) {
            await trackerTask;
        }

        Mod.Log.Info(
            $"HTTP: Request #{requestId} completed ({request.responseCode}).");

        return;

        async Task TrackRequestProgress() {
            var uploadProgress = -1f;
            var downloadProgress = -1f;

            while (!request.isDone) {
                // ReSharper disable CompareOfFloatsByEqualityOperator
                // We don't derive floats from any calculations so this is fine.
                if (
                    uploadProgress != request.uploadProgress ||
                    downloadProgress != request.downloadProgress) {
                    uploadProgress = request.uploadProgress;
                    downloadProgress = request.downloadProgress;

                    progressHandler(uploadProgress, downloadProgress);
                }

                // ReSharper restore CompareOfFloatsByEqualityOperator

                // 1. We execute this Task on the main thread, so we *need* to
                //    yield to the main thread to let it do its work.
                // 2. No need to update continuously, so even if this was in the
                //    thread pool, we can wait some time between updates.
                await Task.Yield();
            }

            progressHandler(1f, 1f);
        }
    }

    private static T ParseResponse<T>(UnityWebRequest request) where T : new() {
        HttpQueries.RequestIdsMap.TryGetValue(request, out var requestId);
        requestId ??= "?";

        if (!request.isDone) {
            throw new InvalidOperationException(
                $"Request #{requestId} is not done.");
        }

        try {
            // First handle classical pure network errors (ex. no internet, host
            // unreachable, etc.).
            if (request.result
                is UnityWebRequest.Result.ConnectionError
                or UnityWebRequest.Result.DataProcessingError) {
                throw new HttpNetworkException(requestId, request.error);
            }

            // Unity's client is high level and interprets non-2xx status codes
            // as "protocol errors".
            if (request.result is UnityWebRequest.Result.ProtocolError) {
                var error = HttpQueries.ParseResponseJson<JsonError>(request);

                throw request.responseCode < 500
                    ? new HttpUserException(requestId, error)
                    : new HttpServerException(requestId, error);
            }

            // So far so good, we can parse the JSON response.
            // This will throw if the JSON is invalid, our job here is done.
            return HttpQueries.ParseResponseJson<T>(request);
        }
        catch (Exception ex) {
            var prevShowsErrorsInUI = Mod.Log.showsErrorsInUI;
            Mod.Log.showsErrorsInUI = false;

            // If this is a network error (or else), log as-is.
            if (request.result is not UnityWebRequest.Result.ProtocolError) {
                Mod.Log.Error(ex, $"HTTP: Error sending request #{requestId}.");
            }

            // If this is an HTTP error, log the response body as well.
            if (request.result is UnityWebRequest.Result.ProtocolError) {
                Mod.Log.Error(
                    $"HTTP: Error response {request.responseCode} " +
                    $"for request #{requestId}: {request.downloadHandler.text}");
            }

            Mod.Log.showsErrorsInUI = prevShowsErrorsInUI;

            throw;
        }
    }

    private static T ParseResponseJson<T>(UnityWebRequest request)
        where T : new() {
        HttpQueries.RequestIdsMap.TryGetValue(request, out var requestId);
        requestId ??= "?";

        var json = request.downloadHandler.text;

        try {
            if (string.IsNullOrWhiteSpace(json)) {
                throw new Exception("Empty body response.");
            }

            // This may throw if the JSON is invalid but there is a wide range
            // of exceptions that can be thrown here, so we will catch them all
            // and interpret them as a parsing error.
            var variant = JSON.Load(json);

            // Colossal's JSON library does always throw an exception when
            // parsing invalid JSON, so we need to check for null here.
            // It's kinda inconsistent, for example parsing `foo` (not valid
            // JSON) yields null, but parsing `{foo: "bar"}` would throw a
            // `JSONFormatUnexpectedEndException`.
            if (variant is null) {
                throw new Exception("Response is not valid JSON.");
            }

            // This may throw various exception, like with `JSON.Load()` we will
            // handle any Exception as a parsing error.
            return variant.Make<T>();
        }
        catch (Exception ex) {
            throw new HttpNetworkException(
                requestId,
                $"Failed to parse JSON response into {typeof(T).FullName}: " +
                ex.Message, ex);
        }
    }

    internal class JsonError {
        [DecodeAlias("message")]
        public string Message { get; private set; } = "Unknown error.";
    }
}
