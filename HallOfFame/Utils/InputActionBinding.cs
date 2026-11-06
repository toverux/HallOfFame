using cohtml.Net;
using Colossal.UI.Binding;
using Game.Input;
using UnityEngine.InputSystem;

namespace HallOfFame.Utils;

/// <summary>
/// <para>
/// Composite binding that holds an input binding configuration (<see cref="ProxyBinding"/>) and its
/// related action's phase (i.e., is the related <see cref="ProxyAction"/> being performed, see
/// <see cref="InputActionPhase"/>).
/// </para>
/// <para>
/// The <see cref="ProxyAction"/> is enabled when the action binding is subscribed to, making the
/// action entirely frontend-driven.
/// </para>
/// <para>
/// The binding is exposed through the ".binding" suffix, and the action phase through the ".phase"
/// suffix, appended to the name passed in the constructor.
/// </para>
/// </summary>
internal sealed class InputActionBinding : CompositeBinding {
  internal InputActionBinding(
    string group,
    string name,
    ProxyBinding binding
  ) {
    var action = InputManager.instance.FindAction(binding);

    var bindingBinding = new BindingValueBinding(group, $"{name}.binding", binding);

    var actionPhaseBinding = new ActionPhaseValueBinding(group, $"{name}.phase", action);

    this.AddBinding(bindingBinding);
    this.AddBinding(actionPhaseBinding);
  }

  /// <summary>
  /// Value binding for the current binding configuration.
  /// Contrarily to the <see cref="ProxyAction"/>, a <see cref="ProxyBinding"/> instance is
  /// recreated each time the user reconfigures the input binding.
  /// This binding takes the initial binding instance and tracks the changes to update the current
  /// binding instance.
  /// </summary>
  internal sealed class BindingValueBinding : ValueBinding<ProxyBinding> {
    // Rebuilt on each attachment, see Attach.
    private ProxyBinding.Watcher? watcher;

    internal BindingValueBinding(
      string group,
      string name,
      ProxyBinding binding
    )
      : base(
        group,
        name,
        binding,
        comparer: new AlwaysFalseEqualityComparer<ProxyBinding>()
      ) {
    }

    // Built per attachment, as the game detaches and re-attaches bindings on UI navigation
    // (decompile, UserInterface.OnNavigateTo), and a disposed watcher cannot be reused.
    public override void Attach(View view) {
      base.Attach(view);

      this.watcher = new ProxyBinding.Watcher(this.value, this.Update);
    }

    public override void Detach() {
      base.Detach();

      this.watcher?.Dispose();
      this.watcher = null;
    }
  }

  /// <summary>
  /// Value binding for the current action phase.
  /// This binding enables and disables the related <see cref="ProxyAction"/> depending on whether
  /// the binding is being subscribed or not.
  /// It reflects the current action's phase as its value.
  /// </summary>
  internal sealed class ActionPhaseValueBinding : ValueBinding<InputActionPhase> {
    private readonly ProxyAction action;

    internal ActionPhaseValueBinding(
      string group,
      string name,
      ProxyAction action
    ) : base(
      group,
      name,
      InputActionPhase.Waiting,
      new EnumNameWriter<InputActionPhase>()
    ) {
      this.action = action;
    }

    // Subscribed per attachment, as the game detaches and re-attaches bindings on UI navigation.
    public override void Attach(View view) {
      base.Attach(view);

      this.action.onInteraction += this.OnActionInteraction;
    }

    public override void Detach() {
      base.Detach();

      this.action.onInteraction -= this.OnActionInteraction;
      this.action.shouldBeEnabled = false;

      // A phase change while detached is never received, so the value re-attaches as idle rather
      // than replaying a stale Performed (decompile, ValueBinding.OnSubscribe re-sends it).
      this.Update(InputActionPhase.Waiting);
    }

    protected override void OnSubscribe() {
      base.OnSubscribe();

      this.action.shouldBeEnabled = true;
    }

    protected override void OnUnsubscribe() {
      base.OnUnsubscribe();

      this.action.shouldBeEnabled = this.active;
    }

    private void OnActionInteraction(ProxyAction _, InputActionPhase phase) => this.Update(phase);
  }
}
