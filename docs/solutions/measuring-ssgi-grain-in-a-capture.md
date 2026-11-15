---
date: 2026-11-15
area: Systems/Capture
symptoms:
  - 'Round, blotchy grain over roads and grass in a capture taken with SSGI on'
  - 'Two captures of the same paused frame differ by about 22 dB'
  - 'An eval sent right after a capture hangs the game for 15 s'
tags: [ssgi, capture, measurement, grain, unity-devtools]
---

# Measuring SSGI grain in a capture

## Problem

Captures turn global illumination (SSGI) off (`docs/adr/0004-no-ssgi-in-captures.md`).
Checking whether a game or HDRP update fixed SSGI's convergence takes a number, as the grain is
easy to miss by eye at full size.

## What didn't work

- Comparing captures with the simulation paused: the weather keeps drifting, and two identical
  SSGI-off captures differed by 22.5 dB. With `UnityEngine.Time.timeScale = 0` they differ by
  47.6 dB.
- An eval sent about 1 s after a capture: the main thread waited 15 s in native code, likely the
  debugger's suspend meeting the background encode. Wait about 6 s after each capture.
- Capturing right after a load: trees and water are still streaming in. Wait for the scene.

## Fix

In a Debug build, with SSGI at High and an upscaler live:

1. Open photo mode and keep the camera still. Pin the time with `PlanetarySystem.overrideTime = true`
   and `time = 18.75` (golden hour, where SSGI shows most). A new city can start at a latitude and
   day that put 18:45 at night: day 163, latitude 37.22 was used.
2. Capture with `CaptureUISystem.DebugCapture()`, once with `Mod.Settings.CaptureWithGlobalIllumination`
   off as the reference, then with it on. `CaptureDebugProbe.RenderCountOverride` sets the render
   count. The report's `RenderStateDuring` confirms the SSGI state. Wait 4 s after any change of
   time or camera.
3. Run the script on the two PNGs. Grain is the RMS of the high-pass of on minus off luma, in 8-bit
   units: SSGI's smooth extra light cancels in the high-pass, its speckle stays.

```python
"""usage: grain.py <off.png> <on.png>..."""
import sys

import numpy as np
from PIL import Image


def luma(path):
    a = np.asarray(Image.open(path).convert("RGB"), np.float64)
    return a @ np.array([0.299, 0.587, 0.114])


def box(a, r):
    for axis in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in (0, 1)], "edge"), axis)
        a = (np.take(c, range(2 * r + 1, c.shape[axis]), axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis)) / (2 * r + 1)
    return a


off = luma(sys.argv[1])
for p in sys.argv[2:]:
    d = luma(p) - off
    hp = d - box(d, 4)
    psnr = 10 * np.log10(255 ** 2 / np.mean(d ** 2))
    print(f"{p.split('/')[-1]:24} PSNR {psnr:6.2f} dB  mean {d.mean():+6.2f}  grain {np.sqrt(np.mean(hp ** 2)):5.2f}")
```

On game 1.6.4f1, at 4K: the live 1080p frame with DLSS measured 2.95. A capture of 8 renders
measured 5.7-6.0 on an RTX 4070 and 4.8 on an RX 6950 XT, and one of 32 renders measured about 3.

## Prevention

A capture's grain close to the live frame's at the capture's normal render count means SSGI can
come back in captures: re-read the ADR's alternatives then.
