using System;
using System.Collections.Generic;
using cohtml.Net;
using Colossal.UI;
using UnityEngine;
using Object = UnityEngine.Object;

namespace HallOfFame.Systems.Capture;

/// <summary>
/// Serves each capture's preview texture to the UI as a <c>live://</c> image, which Cohtml shows in
/// the frame it requests it, where an image file costs a few frames to load and decode.
/// The game's user images manager counts every request for a texture and forgets it once Cohtml has
/// dropped them all, so a retired texture is destroyed only then: the UI may still draw it until it
/// drops it.
/// Engine-bound, so it is checked in the running game.
/// </summary>
internal sealed class CapturePreviewTextures : IDisposable {
  private readonly UserImagesManager userImages = UIManager.defaultUISystem.userImagesManager;

  private readonly Dictionary<string, RenderTexture> servedTextures = [];

  private readonly List<RenderTexture> retiredTextures = [];

  internal CapturePreviewTextures() {
    this.userImages.AllocateUserImageData += this.Allocate;

    // Raised after the manager's own handler, subscribed when the UI system was created, has
    // counted the drop.
    UIManager.instance.unityPluginListener.PreloadedTextureReleased += this.OnTextureDropped;
  }

  /// <summary>
  /// Serves <paramref name="texture"/> at the <c>live://</c> URL whose path is
  /// <paramref name="name"/>, a slash first, until it is retired; this then owns the texture.
  /// </summary>
  internal void Serve(RenderTexture texture, string name) {
    // The manager finds a texture it already counts by the URL's path, matched to its name.
    texture.name = name;

    this.servedTextures[name] = texture;
  }

  /// <summary>
  /// Stops serving the texture named <paramref name="name"/>, and destroys it once the UI no longer
  /// uses it.
  /// </summary>
  internal void Retire(string name) {
    if (!this.servedTextures.Remove(name, out var texture)) {
      return;
    }

    if (this.IsInUse(texture)) {
      this.retiredTextures.Add(texture);
    }
    else {
      Object.DestroyImmediate(texture);
    }
  }

  public void Dispose() {
    this.userImages.AllocateUserImageData -= this.Allocate;

    UIManager.instance.unityPluginListener.PreloadedTextureReleased -= this.OnTextureDropped;
  }

  private bool IsInUse(RenderTexture texture) =>
    this.userImages.GetUserImageTarget(texture.name, 0, 0) != null;

  /// <summary>
  /// Answers a <c>live://</c> request the manager does not count a texture for yet, for any mod:
  /// null leaves a name this does not serve to the next handler.
  /// </summary>
  private ResourceResponse.UserImageData? Allocate(string name, int width, int height) =>
    this.servedTextures.TryGetValue(name, out var texture)
      ? this.userImages.GetUserImageData(
        texture,
        UserImagesManager.ResourceType.Unmanaged,
        isDynamic: false
      )
      : null;

  private void OnTextureDropped(IntPtr texturePtr) {
    for (var i = this.retiredTextures.Count - 1; i >= 0; i--) {
      var texture = this.retiredTextures[i];

      if (!this.IsInUse(texture)) {
        Object.DestroyImmediate(texture);

        this.retiredTextures.RemoveAt(i);
      }
    }
  }
}
