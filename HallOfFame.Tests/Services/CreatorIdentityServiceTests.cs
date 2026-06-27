using System;
using System.Threading;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using HallOfFame.Utils;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class CreatorIdentityServiceTests {
  [Fact]
  public void ResolveCreatorId_KeepsExistingValidGuid_WithoutChange() {
    var existingId = Guid.NewGuid().ToString();

    var resolution = CreatorIdentityService.ResolveCreatorId(existingId, "paradox-id");

    Assert.False(resolution.Changed);
    Assert.Equal(existingId, resolution.CreatorId);
  }

  [Fact]
  public void ResolveCreatorId_AdoptsParadoxId_WhenExistingIsNotAValidGuid() {
    var resolution = CreatorIdentityService.ResolveCreatorId("not-a-guid", "paradox-id");

    Assert.True(resolution.Changed);
    Assert.Equal("paradox-id", resolution.CreatorId);
    Assert.True(resolution.IsParadoxAccountId);
    Assert.False(resolution.NeedsParadoxWarning);
  }

  [Fact]
  public void ResolveCreatorId_GeneratesRandomGuid_WhenNoParadoxId() {
    var resolution = CreatorIdentityService.ResolveCreatorId(null, null);

    Assert.True(resolution.Changed);
    Assert.False(resolution.IsParadoxAccountId);
    Assert.True(resolution.NeedsParadoxWarning);
    Assert.True(Guid.TryParse(resolution.CreatorId, out _));
  }

  [Fact]
  public async Task RunSync_ReturnsLoggedInAsStatus_ForNamedCreator() {
    var service = new CreatorIdentityService(
      new FakeApi {
        GetMeImpl = () => Task.FromResult(new Creator { Id = "creator-id", CreatorName = "Alice" })
      },
      new FakeModLog(),
      _ => { }
    );

    var result = await service.RunSync(CreatorSyncTrigger.NameEdited, CancellationToken.None);

    Assert.NotNull(result);

    Assert.Equal(
      "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAs]",
      result.Value.id
    );
  }

  [Fact]
  public async Task RunSync_ReturnsAnonymousStatus_ForEmptyName() {
    var service = new CreatorIdentityService(
      new FakeApi {
        GetMeImpl = () => Task.FromResult(new Creator { Id = "creator-id", CreatorName = "" })
      },
      new FakeModLog(),
      _ => { }
    );

    var result = await service.RunSync(CreatorSyncTrigger.NameEdited, CancellationToken.None);

    Assert.NotNull(result);

    Assert.Equal(
      "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAnonymously]",
      result.Value.id
    );
  }

  [Fact]
  public async Task RunSync_ReturnsNull_WhenSilent() {
    // OtherSettingChanged is the silent trigger; it pushes full info via UpdateMe.
    var service = new CreatorIdentityService(
      new FakeApi {
        UpdateMeImpl =
          () => Task.FromResult(new Creator { Id = "creator-id", CreatorName = "Alice" })
      },
      new FakeModLog(),
      _ => { }
    );

    var result =
      await service.RunSync(CreatorSyncTrigger.OtherSettingChanged, CancellationToken.None);

    Assert.Null(result);
  }

  [Fact]
  public async Task RunSync_ReturnsUserFriendlyMessage_OnError() {
    var exception = new HttpServerException("req-id", new HttpQueries.JsonError());

    var service = new CreatorIdentityService(
      new FakeApi { GetMeImpl = () => throw exception },
      new FakeModLog(),
      _ => { }
    );

    var result = await service.RunSync(CreatorSyncTrigger.NameEdited, CancellationToken.None);

    Assert.NotNull(result);
    Assert.Equal(exception.GetUserFriendlyMessage(), result.Value);
  }

  [Fact]
  public void PlanFor_MapsEachTriggerToItsPlan() {
    Assert.Equal(
      new CreatorIdentityService.SyncPlan(FullInfo: true, Silent: false, Debounce: false),
      CreatorIdentityService.PlanFor(CreatorSyncTrigger.Startup)
    );

    Assert.Equal(
      new CreatorIdentityService.SyncPlan(FullInfo: false, Silent: false, Debounce: true),
      CreatorIdentityService.PlanFor(CreatorSyncTrigger.NameEdited)
    );

    Assert.Equal(
      new CreatorIdentityService.SyncPlan(FullInfo: true, Silent: true, Debounce: true),
      CreatorIdentityService.PlanFor(CreatorSyncTrigger.OtherSettingChanged)
    );
  }
}
