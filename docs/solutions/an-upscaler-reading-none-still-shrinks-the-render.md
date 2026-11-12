---
date: 2026-11-12
area: Systems/Capture
symptoms:
  - '`capture.isUpscalerForcedOff` False while `TNDUpscaler.enabled` is true'
  - 'DLSS comes back in the middle of a capture'
tags: [tnd, upscaler, dlss, xess, fsr, render-scale, capture, reflection]
---

# An upscaler reading None still shrinks the render

## Problem

The capture switched the upscaler off only when `TNDUpscaler.GetActiveUpscaler()` named one. An
enabled component with no active plugin was left on, and the shot rendered below its size.

## Root cause

`GetActiveUpscaler()` returns the context's active plugin, None when none was created
(`TND.Upscaling.Framework/UpscalerController.cs`, `GetCurrentlyActiveUpscalerPlugin`). The render
scale comes from the quality mode alone (`UpscalerController_HDRP.Update`), and with no plugin
`UpscalerContext.Execute` stretches the image through its fallback blit. A render size change
restarts the context, so a capture's 4K render brings the plugin back mid-capture.

## Fix

Key "does TND scale this camera" on `component.enabled` (`ScreenshotCapturer.Capture`), and keep
`GetActiveUpscaler()` for which upscaler it is.

## Prevention

Reproduce the state in the running game by nulling the plugin through the unity eval, which is also
how a plugin that failed to create looks:

```csharp
var c = UnityEngine.Camera.main.GetComponent<TND.Upscaling.Framework.TNDUpscaler>();
var ctx = typeof(TND.Upscaling.Framework.UpscalerController).GetProperty("UpscalerContext", (System.Reflection.BindingFlags)52).GetValue(c);
typeof(TND.Upscaling.Framework.UpscalerContext).GetField("_activeUpscalerPlugin", (System.Reflection.BindingFlags)36).SetValue(ctx, null);
```

`enabled` stays true and `GetActiveUpscaler()` reads None until the next size change.
