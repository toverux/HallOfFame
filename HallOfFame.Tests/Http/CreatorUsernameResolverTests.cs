using HallOfFame.Http;
using Xunit;

namespace HallOfFame.Tests.Http;

public sealed class CreatorUsernameResolverTests {
  [Fact]
  public void Resolve_ExtractsUsername_FromAuthorsUrl() {
    Assert.Equal(
      "toverux",
      CreatorUsernameResolver.Resolve("https://mods.paradoxplaza.com/authors/toverux")
    );
  }

  [Theory]
  [InlineData("https://mods.paradoxplaza.com/authors/toverux/mods")]
  [InlineData("https://mods.paradoxplaza.com/authors/toverux?tab=mods")]
  [InlineData("https://mods.paradoxplaza.com/authors/toverux#bio")]
  public void Resolve_StopsAtPathQueryOrFragmentBoundary(string url) {
    // The capture group is greedy but excludes "/", "?" and "#", so a trailing path segment, query
    // string, or fragment is not swallowed into the username.
    Assert.Equal("toverux", CreatorUsernameResolver.Resolve(url));
  }

  [Fact]
  public void Resolve_ReturnsNull_WhenNoAuthorsSegment() {
    Assert.Null(CreatorUsernameResolver.Resolve("https://mods.paradoxplaza.com/mods/12345"));
  }
}
