using System;
using Colossal.UI.Binding;
using Game.UI;
using HallOfFame.Services;
using HallOfFame.Utils.Writers;

namespace HallOfFame.Systems;

/// <summary>
/// The Creator Dashboard's thin binding shell over <see cref="DashboardService"/>:
/// it registers the bindings, forwards the UI's triggers to the service,
/// and implements <see cref="IDashboardPresentationSink"/>.
/// C# owns whether the panel is open, so every entry point opens it the same way.
/// </summary>
internal sealed partial class DashboardUISystem : UISystemBase, IDashboardPresentationSink {
  private const string BindingGroup = "hallOfFame.dashboard";

  private DashboardService service = null!;

  private ValueBinding<DashboardState> stateBinding = null!;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // Bindings are updated when the service publishes, never polled.
      this.Enabled = false;

      this.service = new DashboardService(Mod.Api, Mod.Log, this);

      this.stateBinding = new ValueBinding<DashboardState>(
        DashboardUISystem.BindingGroup,
        "state",
        DashboardState.Closed,
        new DashboardStateValueWriter()
      );

      this.AddBinding(this.stateBinding);

      // Fire-and-forget edges: the service entry points are designed never to throw.
      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "open",
          () => { _ = this.service.Open(); }
        )
      );

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "close",
          this.service.Close
        )
      );

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "refresh",
          () => { _ = this.service.Refresh(); }
        )
      );
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  void IDashboardPresentationSink.Publish(DashboardState state) =>
    this.stateBinding.Update(state);
}
