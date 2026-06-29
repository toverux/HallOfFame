using System;
using System.Threading;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Reflection;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using HallOfFame.Tests.Reflection;
using HallOfFame.Utils;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class CreatorIdentityTests {
  [Fact]
  public void ResolveCreatorId_KeepsExistingValidGuid_WithoutChange() {
    var existingId = Guid.NewGuid().ToString();

    var resolution = CreatorIdentity.ResolveCreatorId(existingId, "paradox-id");

    Assert.False(resolution.Changed);
    Assert.Equal(existingId, resolution.CreatorId);
  }

  [Fact]
  public void ResolveCreatorId_AdoptsParadoxId_WhenExistingIsNotAValidGuid() {
    var resolution = CreatorIdentity.ResolveCreatorId("not-a-guid", "paradox-id");

    Assert.True(resolution.Changed);
    Assert.Equal("paradox-id", resolution.CreatorId);
    Assert.True(resolution.IsParadoxAccountId);
    Assert.False(resolution.NeedsParadoxWarning);
  }

  [Fact]
  public void ResolveCreatorId_GeneratesRandomGuid_WhenNoParadoxId() {
    var resolution = CreatorIdentity.ResolveCreatorId(null, null);

    Assert.True(resolution.Changed);
    Assert.False(resolution.IsParadoxAccountId);
    Assert.True(resolution.NeedsParadoxWarning);
    Assert.True(Guid.TryParse(resolution.CreatorId, out _));
  }

  [Fact]
  public void Bootstrap_KeepsExistingValidGuid_WithoutSavingOrWarning() {
    var existingId = Guid.NewGuid().ToString();
    var store = new FakeStore { CreatorID = existingId };
    var paradox = new FakeParadoxConnection { ReadAccountIdImpl = () => "paradox-id" };

    CreatorIdentityTests.CreateIdentity(store: store, paradox: paradox).Bootstrap();

    Assert.Equal(existingId, store.CreatorID);
    Assert.False(store.IsParadoxAccountID);
    Assert.Equal(0, store.SaveCount);
    Assert.Equal(0, paradox.WarningShownCount);
  }

  [Fact]
  public void Bootstrap_AdoptsParadoxId_AndSaves() {
    var store = new FakeStore { CreatorID = null };
    var paradox = new FakeParadoxConnection { ReadAccountIdImpl = () => "paradox-id" };

    CreatorIdentityTests.CreateIdentity(store: store, paradox: paradox).Bootstrap();

    Assert.Equal("paradox-id", store.CreatorID);
    Assert.True(store.IsParadoxAccountID);
    Assert.Equal(1, store.SaveCount);
    Assert.Equal(0, paradox.WarningShownCount);
  }

  [Fact]
  public void Bootstrap_FallsBackToRandomId_AndWarns_WhenNotLoggedIn() {
    // A clean null read means the user is simply not logged in to Paradox: warn and fall back.
    var store = new FakeStore { CreatorID = null };
    var paradox = new FakeParadoxConnection { ReadAccountIdImpl = () => null };

    CreatorIdentityTests.CreateIdentity(store: store, paradox: paradox).Bootstrap();

    Assert.True(Guid.TryParse(store.CreatorID, out _));
    Assert.False(store.IsParadoxAccountID);
    Assert.Equal(1, store.SaveCount);
    Assert.Equal(1, paradox.WarningShownCount);
  }

  [Fact]
  public void Bootstrap_FallsBackToRandomId_WithoutWarning_WhenReadThrows() {
    // A thrown read is an unexpected failure, not a "not logged in": fall back but do not warn.
    var store = new FakeStore { CreatorID = null };
    var paradox = new FakeParadoxConnection {
      ReadAccountIdImpl = () => throw new InvalidOperationException("read failed")
    };

    CreatorIdentityTests.CreateIdentity(store: store, paradox: paradox).Bootstrap();

    Assert.True(Guid.TryParse(store.CreatorID, out _));
    Assert.False(store.IsParadoxAccountID);
    Assert.Equal(1, store.SaveCount);
    Assert.Equal(0, paradox.WarningShownCount);
  }

  [Fact]
  public void BuildAuthorizationHeader_UsesParadoxProvider_AndEscapesName() {
    var store = new FakeStore {
      CreatorName = "John Doe", CreatorID = "creator-id", IsParadoxAccountID = true
    };

    var header = CreatorIdentityTests
      .CreateIdentity(store: store, hwid: "device-42")
      .BuildAuthorizationHeader();

    Assert.Equal(
      "Creator name=John%20Doe&id=creator-id&provider=paradox&hwid=device-42",
      header
    );
  }

  [Theory]
  [InlineData(null)]
  [InlineData("")]
  public void BuildAuthorizationHeader_UsesLocalProviderAndEmptyName_WhenNameNullOrEmpty(
    string? name
  ) {
    var store = new FakeStore {
      CreatorName = name, CreatorID = "creator-id", IsParadoxAccountID = false
    };

    var header = CreatorIdentityTests
      .CreateIdentity(store: store, hwid: "device-42")
      .BuildAuthorizationHeader();

    Assert.Equal(
      "Creator name=&id=creator-id&provider=local&hwid=device-42",
      header
    );
  }

  [Fact]
  public void NextSyncTrigger_DiffsCreatorName_AndAdvancesBaseline() {
    var store = new FakeStore { CreatorName = "Alice" };

    var identity = CreatorIdentityTests.CreateIdentity(store: store);

    // First applied event: the unseeded baseline (null) differs from "Alice", so a name edit.
    Assert.Equal(CreatorSyncTrigger.NameEdited, identity.NextSyncTrigger());

    // Same name on the next event, so any-other-setting change: proves the baseline advanced.
    Assert.Equal(CreatorSyncTrigger.OtherSettingChanged, identity.NextSyncTrigger());

    // Editing the name again is a name edit once more.
    store.CreatorName = "Bob";
    Assert.Equal(CreatorSyncTrigger.NameEdited, identity.NextSyncTrigger());
  }

  [Fact]
  public async Task RunSync_ReturnsLoggedInAsStatus_ForNamedCreator() {
    var identity = CreatorIdentityTests.CreateIdentity(
      new FakeApi {
        GetMeImpl = () => Task.FromResult(new Creator { Id = "creator-id", CreatorName = "Alice" })
      }
    );

    var result = await identity.RunSync(CreatorSyncTrigger.NameEdited, CancellationToken.None);

    Assert.NotNull(result);

    Assert.Equal(
      "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAs]",
      result.Value.id
    );
  }

  [Fact]
  public async Task RunSync_ReturnsAnonymousStatus_ForEmptyName() {
    var identity = CreatorIdentityTests.CreateIdentity(
      new FakeApi {
        GetMeImpl = () => Task.FromResult(new Creator { Id = "creator-id", CreatorName = "" })
      }
    );

    var result = await identity.RunSync(CreatorSyncTrigger.NameEdited, CancellationToken.None);

    Assert.NotNull(result);

    Assert.Equal(
      "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAnonymously]",
      result.Value.id
    );
  }

  [Fact]
  public async Task RunSync_ReturnsNull_WhenSilent() {
    // OtherSettingChanged is the silent trigger; it pushes full info via UpdateMe.
    var identity = CreatorIdentityTests.CreateIdentity(
      new FakeApi {
        UpdateMeImpl =
          () => Task.FromResult(new Creator { Id = "creator-id", CreatorName = "Alice" })
      }
    );

    var result =
      await identity.RunSync(CreatorSyncTrigger.OtherSettingChanged, CancellationToken.None);

    Assert.Null(result);
  }

  [Fact]
  public async Task RunSync_ReturnsUserFriendlyMessage_OnError() {
    var exception = new HttpServerException("req-id", new HttpQueries.JsonError());

    var identity = CreatorIdentityTests.CreateIdentity(
      new FakeApi { GetMeImpl = () => throw exception }
    );

    var result = await identity.RunSync(CreatorSyncTrigger.NameEdited, CancellationToken.None);

    Assert.NotNull(result);
    Assert.Equal(exception.GetUserFriendlyMessage(), result.Value);
  }

  [Fact]
  public void PlanFor_MapsEachTriggerToItsPlan() {
    Assert.Equal(
      new CreatorIdentity.SyncPlan(FullInfo: true, Silent: false, Debounce: false),
      CreatorIdentity.PlanFor(CreatorSyncTrigger.Startup)
    );

    Assert.Equal(
      new CreatorIdentity.SyncPlan(FullInfo: false, Silent: false, Debounce: true),
      CreatorIdentity.PlanFor(CreatorSyncTrigger.NameEdited)
    );

    Assert.Equal(
      new CreatorIdentity.SyncPlan(FullInfo: true, Silent: true, Debounce: true),
      CreatorIdentity.PlanFor(CreatorSyncTrigger.OtherSettingChanged)
    );
  }

  /// <summary>
  /// Builds a <see cref="CreatorIdentity"/> with default fakes, letting each test override only the
  /// collaborators it exercises.
  /// </summary>
  private static CreatorIdentity CreateIdentity(
    IHallOfFameApi? api = null,
    ICreatorIdentityStore? store = null,
    IParadoxConnection? paradox = null,
    IModLog? log = null,
    string hwid = "hwid"
  ) => new(
    api ?? new FakeApi(),
    log ?? new FakeModLog(),
    store ?? new FakeStore(),
    hwid,
    paradox ?? new FakeParadoxConnection()
  );
}
