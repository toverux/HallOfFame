using System;
using System.Globalization;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Colossal.Json;
using Game;
using Game.SceneFlow;
using HallOfFame.Utils;
using UnityEngine;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    internal delegate void ProgressHandler(
        float uploadProgress,
        float downloadProgress);

    private const string BaseApiPath = "/api/v1";

    private static string HardwareId { get; } =
        SystemInfo.deviceUniqueIdentifier;

    private static ushort lastRequestId;

    /// <summary>
    /// Weak table that maps UnityWebRequest instances to request IDs for
    /// tracking requests in logs.
    /// The value has to be a reference type, so we use a string where we
    /// serialize `++<see cref="lastRequestId"/>`.
    /// </summary>
    private static readonly ConditionalWeakTable<UnityWebRequest, string>
        RequestIdsMap = new();

    private static string PrependApiUrl(string path) =>
        $"{Mod.Settings.BaseUrlWithScheme}{HttpQueries.BaseApiPath}{path}";

    private static async Task SendRequest(
        UnityWebRequest request,
        ProgressHandler? progressHandler = null) {
        // When using directly the UnityWebRequest constructor directly, for
        // example when making POST requests with empty body, the download
        // handler is not set, which prevents us from reading the response.
        request.downloadHandler ??= new DownloadHandlerBuffer();

        HttpQueries.AddModHeaders(request);

        var requestId = (++HttpQueries.lastRequestId).ToString();

        HttpQueries.RequestIdsMap.Add(request, requestId);

        Mod.Log.Info(
            $"HTTP: Sending request #{requestId} {request.method} {request.url}");

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

    private static void AddModHeaders(UnityWebRequest request) {
        if (!request.uri.AbsolutePath.StartsWith(HttpQueries.BaseApiPath)) {
            return;
        }

        var creatorName = Mod.Settings.CreatorName is null
            ? string.Empty
            : Uri.EscapeDataString(Mod.Settings.CreatorName);

        var provider = Mod.Settings.IsParadoxAccountID ? "paradox" : "local";

        request.SetRequestHeader(
            "Authorization",
            "Creator " +
            $"name={creatorName}" +
            $"&id={Mod.Settings.CreatorID}" +
            $"&provider={provider}" +
            $"&hwid={HttpQueries.HardwareId}");

        request.SetRequestHeader(
            "Accept-Language",
            GameManager.instance.localizationManager.activeLocaleId);

        request.SetRequestHeader(
            "X-Timezone-Offset",
            TimeZoneInfo.Local
                .GetUtcOffset(DateTime.Now)
                // For some reason `.Minutes` (int of full minutes) is always 0.
                // But UTC offsets are always full minutes so this is fine.
                .TotalMinutes
                .ToString(CultureInfo.InvariantCulture));
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
            // ReSharper disable once ConvertIfStatementToSwitchStatement
            if (request.result
                is UnityWebRequest.Result.ConnectionError
                or UnityWebRequest.Result.DataProcessingError) {
                throw new HttpNetworkException(requestId, request.error);
            }

            // Unity's client is high level and interprets non-2xx status codes
            // as "protocol errors".
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
                    $"HTTP: Error sending request #{requestId}.");
            }

            // If this is an HTTP error, log the response body as well.
            if (request.result is UnityWebRequest.Result.ProtocolError) {
                Mod.Log.ErrorSilent(
                    $"HTTP: Error response {request.responseCode} " +
                    $"for request #{requestId}: {request.downloadHandler.text}");
            }

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
