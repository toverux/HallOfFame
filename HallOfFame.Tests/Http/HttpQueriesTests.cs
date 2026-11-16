using System;
using HallOfFame.Http;
using Xunit;

namespace HallOfFame.Tests.Http;

public sealed class HttpQueriesTests {
  /// <summary>
  /// A body the mod cannot read back is told apart from a connection failure, while staying an
  /// <see cref="HttpNetworkException"/> so the player's message does not change.
  /// </summary>
  [Theory]
  [InlineData("")]
  [InlineData("foo")]
  [InlineData("{foo: \"bar\"}")]
  public void DecodeJson_UndecodableBody_ThrowsANetworkExceptionMarkedUndecodable(string body) {
    var ex = Assert.Throws<HttpNetworkException>(() =>
      HttpQueries.DecodeJson<HttpQueries.JsonError>("1", body)
    );

    Assert.True(ex.IsUndecodable);
  }

  [Fact]
  public void DecodeJson_ValidBody_MapsIt() {
    var error = HttpQueries.DecodeJson<HttpQueries.JsonError>("1", "{\"message\": \"Nope.\"}");

    Assert.Equal("Nope.", error.Message);
  }

  /// <summary>
  /// An error status picks the exception even when its body is not the server's JSON, as a proxy's
  /// HTML error page is not: the status already says how the request failed.
  /// </summary>
  [Theory]
  [InlineData(502, typeof(HttpServerException))]
  [InlineData(413, typeof(HttpUserException))]
  [InlineData(404, typeof(HttpUserCompatibilityException))]
  public void GetProtocolException_NonJsonBody_PicksTheExceptionByStatus(
    long responseCode,
    Type expectedType
  ) {
    var ex = HttpQueries.GetProtocolException("1", responseCode, "<html>Bad Gateway</html>");

    Assert.IsType(expectedType, ex);
    Assert.StartsWith("Unknown error", ex.Message);
  }
}
