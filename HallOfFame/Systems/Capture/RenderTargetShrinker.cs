using System;
using Game.UI.InGame;
using Unity.Entities;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

namespace HallOfFame.Systems.Capture;

/// <summary>
/// Shrinks HDRP's shared render targets back to the screen size when the photo mode panel closes.
/// HDRP sizes the render targets every camera shares to the largest render it has seen and never
/// shrinks them, so a capture leaves screen-size cameras drawing into a corner of capture-size
/// targets for the rest of the session.
/// Every frame then costs more GPU time on every platform, and on a card short of memory under
/// Proton, the game sits at DXVK's memory budget, where it crawls and its rendering can break.
/// Shrinking at each capture would make every capture pay the regrowth; shrinking when photo mode
/// closes keeps captures in a row fast and makes only the next photo session's first capture pay
/// it.
/// Engine-bound and therefore not unit-testable off-engine.
/// </summary>
internal static class RenderTargetShrinker {
  internal static void Subscribe(World world) {
    var panelSystem = world.GetOrCreateSystemManaged<GamePanelUISystem>();

    panelSystem.eventPanelClosed += RenderTargetShrinker.OnPanelClosed;
  }

  private static void OnPanelClosed(GamePanel panel) {
    if (panel is not PhotoModePanel) {
      return;
    }

    try {
      var (width, height) = (Screen.width, Screen.height);

      // Targets no larger than the screen hold nothing a reset would give back, and the reset still
      // costs a reallocation.
      if (RTHandles.maxWidth <= width && RTHandles.maxHeight <= height) {
        return;
      }

      if (RenderPipelineManager.currentPipeline is not HDRenderPipeline pipeline) {
        return;
      }

      Mod.Log.Info(
        $"{nameof(RenderTargetShrinker)}: Shrinking render targets from " +
        $"{RTHandles.maxWidth}x{RTHandles.maxHeight} to {width}x{height}."
      );

      pipeline.ResetRTHandleReferenceSize(width, height);
    }
    catch (Exception ex) {
      // Silently, as an optimization: a game update breaking it would otherwise raise an error
      // dialog each time photo mode closes.
      Mod.Log.ErrorSilent(ex);
    }
  }
}
