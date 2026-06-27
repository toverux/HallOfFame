using System;
using HallOfFame.Services;
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

  // The four Refresh tests below are intentionally empty and skipped.
  //
  // They cannot run off-engine: exercising Refresh requires constructing a
  // CreatorIdentityService, which holds a Colossal.Logging.ILog. That interface uses default
  // interface methods (e.g. SetEffectiveness, SetShowsErrorsInUI), a feature the .NET Framework 4.8
  // CLR that hosts these tests cannot load, so the JIT throws
  // "TypeLoadException: non-abstract, non-.cctor method in an interface" the moment ILog is loaded
  // (e.g. at LogManager.GetLogger). The game runs on a runtime that supports it, so production is
  // unaffected.
  //
  // They are kept as a record of the intended behavior contract; they would become runnable if the
  // tests moved in-engine or the ILog dependency were replaced by a logging seam owned by the mod.

  [Fact(Skip = "Refresh requires an ILog; ILog has default interface methods unloadable on net48.")]
  public void Refresh_ReturnsLoggedInAsStatus_ForNamedCreator() {
    // Arrange: FakeApi.GetMeImpl returns a Creator with CreatorName "Alice".
    // Act: await service.Refresh(nameOnly: true, silent: false, CancellationToken.None).
    // Assert: result is not null and result.id is
    // "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAs]".
  }

  [Fact(Skip = "Refresh requires an ILog; ILog has default interface methods unloadable on net48.")]
  public void Refresh_ReturnsAnonymousStatus_ForEmptyName() {
    // Arrange: FakeApi.GetMeImpl returns a Creator with an empty CreatorName.
    // Act: await service.Refresh(nameOnly: true, silent: false, CancellationToken.None).
    // Assert: result is not null and result.id is
    // "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAnonymously]".
  }

  [Fact(Skip = "Refresh requires an ILog; ILog has default interface methods unloadable on net48.")]
  public void Refresh_ReturnsNull_WhenSilent() {
    // Arrange: FakeApi.GetMeImpl returns any Creator.
    // Act: await service.Refresh(nameOnly: true, silent: true, CancellationToken.None).
    // Assert: result is null (a silent call writes no status).
  }

  [Fact(Skip = "Refresh requires an ILog; ILog has default interface methods unloadable on net48.")]
  public void Refresh_ReturnsUserFriendlyMessage_OnError() {
    // Arrange: FakeApi.GetMeImpl throws a HttpServerException.
    // Act: await service.Refresh(nameOnly: true, silent: false, CancellationToken.None).
    // Assert: result equals the exception's GetUserFriendlyMessage() (non-silent error surfaces the
    // friendly message).
  }
}
