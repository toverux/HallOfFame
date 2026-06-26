using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[UsedImplicitly]
internal record CreatorStats {
  [DecodeAlias("allCreatorsCount")]
  internal int AllCreatorsCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("allScreenshotsCount")]
  internal int AllScreenshotsCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("allViewsCount")]
  internal int AllViewsCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("screenshotsCount")]
  internal int ScreenshotsCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("viewsCount")]
  internal int ViewsCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("uniqueViewsCount")]
  internal int UniqueViewsCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("favoritesCount")]
  internal int LikesCount {
    get;
    [UsedImplicitly]
    set;
  }
}
