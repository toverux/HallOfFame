using HallOfFame.Utils;
using Xunit;

namespace HallOfFame.Tests.Utils;

public sealed class NullStringsTests {
  [Fact]
  public void Restore_RestoresANullStringFromTheDefaults() {
    var loaded = new FakeSettings {
      Mode = null
    };

    NullStrings.Restore(loaded, new FakeSettings());

    Assert.Equal("default", loaded.Mode);
  }

  [Fact]
  public void Restore_KeepsAStringTheFileSet() {
    var loaded = new FakeSettings {
      Mode = "custom"
    };

    NullStrings.Restore(loaded, new FakeSettings());

    Assert.Equal("custom", loaded.Mode);
  }

  [Fact]
  public void Restore_LeavesNullAStringTheDefaultsLeaveNull() {
    var loaded = new FakeSettings();

    NullStrings.Restore(loaded, new FakeSettings());

    Assert.Null(loaded.Optional);
  }

  [Fact]
  public void Restore_LeavesValueTypesAlone() {
    var loaded = new FakeSettings {
      Count = 0
    };

    NullStrings.Restore(loaded, new FakeSettings());

    Assert.Equal(0, loaded.Count);
  }

  [Fact]
  public void Restore_SkipsAStringWithoutAPublicSetter() {
    var loaded = new FakeSettings();

    loaded.SetHidden(null);

    NullStrings.Restore(loaded, new FakeSettings());

    Assert.Null(loaded.Hidden);
  }

  /// <summary>
  /// The shapes of string and other settings, as constructed then defaulted.
  /// </summary>
  private sealed class FakeSettings {
    public string? Mode { get; set; } = "default";

    public string? Optional { get; set; }

    public int Count { get; set; } = 3;

    public string? Hidden { get; private set; } = "default";

    internal void SetHidden(string? value) => this.Hidden = value;
  }
}
