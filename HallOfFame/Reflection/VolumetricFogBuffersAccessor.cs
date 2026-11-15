using System;
using System.Reflection;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

namespace HallOfFame.Reflection;

/// <summary>
/// HDRP's volumetric fog buffers, which only grow and which
/// <see cref="HDRenderPipeline.ResetRTHandleReferenceSize"/> leaves alone (read in the decompiled
/// <c>HDRenderPipeline</c>): the density and lighting buffers are sized from the running maximum
/// <c>s_CurrentVolumetricBufferSize</c>, and each camera's two history buffers grow in place.
/// Where a game update renamed either, <see cref="Shrink"/> leaves those buffers as they are.
/// </summary>
internal static class VolumetricFogBuffersAccessor {
  /// <summary>
  /// Field accessor for <c>HDRenderPipeline.s_CurrentVolumetricBufferSize</c>.
  /// Null if it was not found.
  /// </summary>
  private static readonly FieldInfo? BufferSizeField;

  /// <summary>
  /// Field accessor for <c>HDCamera.volumetricHistoryBuffers</c>.
  /// Null if it was not found.
  /// </summary>
  private static readonly FieldInfo? HistoryBuffersField;

  static VolumetricFogBuffersAccessor() {
    VolumetricFogBuffersAccessor.BufferSizeField = typeof(HDRenderPipeline).GetField(
      "s_CurrentVolumetricBufferSize",
      BindingFlags.NonPublic | BindingFlags.Static
    );

    VolumetricFogBuffersAccessor.HistoryBuffersField = typeof(HDCamera).GetField(
      "volumetricHistoryBuffers",
      BindingFlags.NonPublic | BindingFlags.Instance
    );

    // Silently, as the shrink is an optimization the player can play without.
    if (
      VolumetricFogBuffersAccessor.BufferSizeField is null ||
      VolumetricFogBuffersAccessor.HistoryBuffersField is null
    ) {
      Mod.Log.ErrorSilent(
        new Exception(
          "Failed to find HDRenderPipeline.s_CurrentVolumetricBufferSize or " +
          "HDCamera.volumetricHistoryBuffers."
        )
      );
    }
    else {
      Mod.Log.Verbose(
        $"{nameof(VolumetricFogBuffersAccessor)}: Acquired " +
        "HDRenderPipeline.s_CurrentVolumetricBufferSize and HDCamera.volumetricHistoryBuffers"
      );
    }
  }

  public static void Init() {
    // Just a method to force-initialize the static constructor.
  }

  /// <summary>
  /// Shrinks the fog buffers to the size the cameras rendering from the next frame on need, each
  /// kind only where its field was found.
  /// </summary>
  internal static void Shrink(Camera camera) {
    // Zeroed, the maximum starts again from the next frame's cameras, the render graph allocates
    // the density and lighting buffers at that size, and it frees the old ones once unused.
    VolumetricFogBuffersAccessor.BufferSizeField?.SetValue(null, Vector3Int.zero);

    var historyBuffers =
      VolumetricFogBuffersAccessor.HistoryBuffersField?.GetValue(HDCamera.GetOrCreate(camera));

    if (historyBuffers is not RTHandle?[] buffers) {
      return;
    }

    for (var i = 0; i < buffers.Length; i++) {
      RTHandles.Release(buffers[i]);

      // HDRP recreates both buffers, at the size the camera needs, at its next frame when it finds
      // one null (ResizeVolumetricHistoryBuffers, in the decompiled HDRenderPipeline).
      buffers[i] = null;
    }
  }
}
