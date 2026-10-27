using System;
using HallOfFame.Services;

namespace HallOfFame.Utils.Writers;

internal static class MenuTourStepExtensions {
  extension(MenuTourStep step) {
    /// <summary>
    /// The step's name in the UI's binding types.
    /// </summary>
    internal string ToWireName() =>
      step switch {
        MenuTourStep.None => "none",
        MenuTourStep.Navigation => "navigation",
        MenuTourStep.MenuVisibility => "menuVisibility",
        MenuTourStep.Like => "like",
        MenuTourStep.Dashboard => "dashboard",
        _ => throw new InvalidOperationException($"Unknown step {step}.")
      };
  }
}
