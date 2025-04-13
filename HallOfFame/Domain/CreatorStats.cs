using Colossal.Json;
using Colossal.UI.Binding;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[UsedImplicitly]
internal record CreatorStats : IJsonWritable {
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

  [DecodeAlias("favoritesCount")]
  internal int FavoritesCount {
    get;
    [UsedImplicitly]
    set;
  }

  public void Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("screenshotsCount");
    writer.Write(this.ScreenshotsCount);

    writer.PropertyName("viewsCount");
    writer.Write(this.ViewsCount);

    writer.PropertyName("favoritesCount");
    writer.Write(this.FavoritesCount);

    writer.TypeEnd();
  }
}
