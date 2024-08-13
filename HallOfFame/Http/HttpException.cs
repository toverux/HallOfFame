using System;

namespace HallOfFame.Http;

/// <summary>
/// Base class for an HTTP error, network or server.
/// </summary>
internal abstract class HttpException(
    string requestId,
    string message,
    Exception? inner = null)
    : Exception(HttpException.ReformatMessage(requestId, message), inner) {
    /// <summary>
    /// Reformat the message to include the request ID (removes period, add
    /// request ID, add period).
    /// </summary>
    private static string ReformatMessage(string requestId, string message) {
        return $"{message.TrimEnd('.')} (Log Request ID #{requestId}).";
    }
}

/// <summary>
/// Class for an HTTP *network* error ("code 0").
/// </summary>
internal sealed class HttpNetworkException(
    string requestId,
    string message,
    Exception? inner = null)
    : HttpException(requestId, message, inner);

/// <summary>
/// Class for an internal server error (HTTP status code 500+).
/// </summary>
/// <param name="requestId"></param>
/// <param name="error"></param>
internal sealed class HttpServerException(
    string requestId,
    HttpQueries.JsonError error)
    : HttpException(requestId, error.Message);

/// <summary>
/// Class for an user error (HTTP status code 400-499).
/// </summary>
/// <param name="requestId"></param>
/// <param name="error"></param>
internal sealed class HttpUserException(
    string requestId,
    HttpQueries.JsonError error)
    : HttpException(requestId, error.Message);
