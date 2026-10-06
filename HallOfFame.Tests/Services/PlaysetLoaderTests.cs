using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Http;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class PlaysetLoaderTests {
  [Fact]
  public async Task Load_PublishesLoading_ThenLoadedWithTheMods() {
    var gate = new TaskCompletionSource<IReadOnlyList<HallOfFame.Domain.Mod>>();

    var api = new FakeApi {
      GetPlaysetImpl = _ => gate.Task
    };

    var published = new List<PlaysetState>();

    var loader = new PlaysetLoader(api, new FakeModLog(), published.Add);

    var load = loader.Load("s0");

    Assert.Equal(PlaysetStatus.Loading, Assert.Single(published).Status);

    var mods = new[] { PlaysetLoaderTests.MakeMod(1), PlaysetLoaderTests.MakeMod(2) };

    gate.SetResult(mods);

    await load;

    Assert.Equal(2, published.Count);
    Assert.Equal("s0", published[1].ScreenshotId);
    Assert.Equal(PlaysetStatus.Loaded, published[1].Status);
    Assert.Equal(mods, published[1].Mods);
  }

  [Fact]
  public async Task Load_Failure_PublishesFailed_AndARetryCanSucceed() {
    var mods = new[] { PlaysetLoaderTests.MakeMod(1) };

    var responses = new Queue<Task<IReadOnlyList<HallOfFame.Domain.Mod>>>(
      [
        Task.FromException<IReadOnlyList<HallOfFame.Domain.Mod>>(
          new HttpNetworkException("1", "timeout")
        ),
        Task.FromResult<IReadOnlyList<HallOfFame.Domain.Mod>>(mods)
      ]
    );

    var api = new FakeApi {
      GetPlaysetImpl = _ => responses.Dequeue()
    };

    var published = new List<PlaysetState>();

    var loader = new PlaysetLoader(api, new FakeModLog(), published.Add);

    await loader.Load("s0");

    Assert.Equal(PlaysetStatus.Failed, published[^1].Status);
    Assert.Empty(published[^1].Mods);

    await loader.Load("s0");

    Assert.Equal(PlaysetStatus.Loading, published[^2].Status);
    Assert.Equal(PlaysetStatus.Loaded, published[^1].Status);
    Assert.Equal(mods, published[^1].Mods);
  }

  [Fact]
  public async Task Load_ALoadedPlaysetAgain_AnswersFromMemoryWithoutASecondRequest() {
    var mods = new[] { PlaysetLoaderTests.MakeMod(1) };

    var requests = new List<string>();

    var api = new FakeApi {
      GetPlaysetImpl = id => {
        requests.Add(id);

        return Task.FromResult<IReadOnlyList<HallOfFame.Domain.Mod>>(mods);
      }
    };

    var published = new List<PlaysetState>();

    var loader = new PlaysetLoader(api, new FakeModLog(), published.Add);

    await loader.Load("s0");

    published.Clear();

    await loader.Load("s0");

    Assert.Equal("s0", Assert.Single(requests));

    // Straight to loaded, with no loading state in between.
    var state = Assert.Single(published);

    Assert.Equal(PlaysetStatus.Loaded, state.Status);
    Assert.Equal(mods, state.Mods);
  }

  /// <summary>
  /// The binding holds one state, so an answer arriving after the viewer moved on to another
  /// screenshot's playset would replace that one's.
  /// </summary>
  [Fact]
  public async Task Load_AnAnswerForAScreenshotNoLongerAskedFor_IsKeptButNotPublished() {
    var gates = new Dictionary<string, TaskCompletionSource<IReadOnlyList<HallOfFame.Domain.Mod>>> {
      ["s0"] = new(),
      ["s1"] = new()
    };

    var requests = new List<string>();

    var api = new FakeApi {
      GetPlaysetImpl = id => {
        requests.Add(id);

        return gates[id].Task;
      }
    };

    var published = new List<PlaysetState>();

    var loader = new PlaysetLoader(api, new FakeModLog(), published.Add);

    var first = loader.Load("s0");
    var second = loader.Load("s1");

    gates["s0"].SetResult([PlaysetLoaderTests.MakeMod(1)]);

    await first;

    Assert.Equal(("s1", PlaysetStatus.Loading), (published[^1].ScreenshotId, published[^1].Status));

    gates["s1"].SetResult([PlaysetLoaderTests.MakeMod(2)]);

    await second;

    Assert.Equal(("s1", PlaysetStatus.Loaded), (published[^1].ScreenshotId, published[^1].Status));

    // The late answer was kept: going back to it sends no request.
    await loader.Load("s0");

    Assert.Equal(["s0", "s1"], requests);
    Assert.Equal(("s0", PlaysetStatus.Loaded), (published[^1].ScreenshotId, published[^1].Status));
  }

  [Fact]
  public async Task Load_AgainWhileInFlight_SendsNoSecondRequest() {
    var gate = new TaskCompletionSource<IReadOnlyList<HallOfFame.Domain.Mod>>();

    var requests = new List<string>();

    var api = new FakeApi {
      GetPlaysetImpl = id => {
        requests.Add(id);

        return gate.Task;
      }
    };

    var published = new List<PlaysetState>();

    var loader = new PlaysetLoader(api, new FakeModLog(), published.Add);

    var first = loader.Load("s0");

    await loader.Load("s0");

    Assert.Equal(PlaysetStatus.Loading, published[^1].Status);

    gate.SetResult([PlaysetLoaderTests.MakeMod(1)]);

    await first;

    Assert.Equal("s0", Assert.Single(requests));
    Assert.Equal(PlaysetStatus.Loaded, published[^1].Status);
  }

  private static HallOfFame.Domain.Mod MakeMod(int paradoxModId) =>
    new() {
      Id = $"m{paradoxModId}",
      ParadoxModId = paradoxModId
    };
}
