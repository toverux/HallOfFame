using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class CreatorStatsServiceTests {
  [Fact]
  public async Task GetNotableStats_ReturnsNull_WhenLikesBelowThreshold() {
    var api = new FakeApi {
      GetCreatorStatsImpl = () => Task.FromResult(new CreatorStats { LikesCount = 1 })
    };

    var result = await new CreatorStatsService(api).GetNotableStats();

    Assert.Null(result);
  }

  [Fact]
  public async Task GetNotableStats_ReturnsStats_WhenLikesMeetThreshold() {
    var stats = new CreatorStats { LikesCount = 5 };

    var api = new FakeApi {
      GetCreatorStatsImpl = () => Task.FromResult(stats)
    };

    var result = await new CreatorStatsService(api).GetNotableStats();

    Assert.Same(stats, result);
  }

  [Fact]
  public async Task GetNotableStats_PropagatesApiError() {
    var api = new FakeApi {
      GetCreatorStatsImpl = () =>
        throw new HttpServerException("42", new HttpQueries.JsonError())
    };

    var service = new CreatorStatsService(api);

    await Assert.ThrowsAsync<HttpServerException>(() => service.GetNotableStats());
  }
}
