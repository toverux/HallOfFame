using System;

namespace HallOfFame.Http;

/// <summary>
/// Base class for an HTTP error, network or server.
/// </summary>
internal abstract class HttpException(
  string requestId,
  string message,
  Exception? inner = null
) : Exception(HttpException.ReformatMessage(requestId, message), inner) {
  /// <summary>
  /// Reformat the message to include the request ID (removes period, add request ID, add period).
  /// </summary>
  private static string ReformatMessage(string requestId, string message) =>
    $"{message.TrimEnd('.')} (log request ID #{requestId}).";
}

/// <summary>
/// Class for an HTTP *network* error ("code 0"), or for a response whose body could not be decoded.
/// </summary>
internal sealed class HttpNetworkException(
  string requestId,
  string message,
  Exception? inner = null
) : HttpException(requestId, message, inner) {
  /// <summary>
  /// Whether the server answered with a body the mod could not parse or map, an empty one included.
  /// It is a wire format mismatch rather than a connection failure, but stays this type, as the
  /// message the player reads is keyed on the exception's type name.
  /// </summary>
  internal bool IsUndecodable { get; init; }
}

/// <summary>
/// Class for an internal server error (HTTP status code 500+).
/// </summary>
internal sealed class HttpServerException(
  string requestId,
  HttpQueries.JsonError error
) : HttpException(requestId, error.Message);

/// <summary>
/// Class for an user error (HTTP status code 400-499).
/// </summary>
internal sealed class HttpUserException(
  string requestId,
  HttpQueries.JsonError error
) : HttpException(requestId, error.Message);

/// <summary>
/// Class for a mod-server compatibility error (HTTP status code 404).
/// A 404 error in the context of the mod is indeed the sign that the mod and server do not use the
/// same version of the API, as it is scoped to "/api/vX".
/// </summary>
internal sealed class HttpUserCompatibilityException(
  string requestId,
  HttpQueries.JsonError error
) : HttpException(requestId, error.Message);
