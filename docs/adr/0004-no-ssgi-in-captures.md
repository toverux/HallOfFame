---
date: 2026-11-15
status: accepted
area: Systems/Capture
---

# Turn global illumination off in every capture, on every GPU

## Context

Captures taken with the game's global illumination (SSGI) on came out covered in round, blotchy
grain. The mod turned SSGI off for the capture through `DisableGlobalIllumination`, a setting that
defaulted to on for NVIDIA cards and was hidden on every other card.

The grain comes from HDRP, not from one vendor's driver. The capture forces the upscaler (DLSS,
FSR, XeSS) off, which changes HDRP's upsampler schedule and makes `HDCamera` dispose its history
render targets. SSGI's temporal filter, and the color pyramid it traces against, then restart from
nothing at the first of the capture's renders. Each render draws new noise (`cameraFrameCount`
advances once per render), so the image converges as renders add up, and 8 renders are too few.

Measured as the RMS of the high-pass of the difference between an SSGI-on and an SSGI-off capture,
on one scene at 4K, captured with the upscaler and SSGI on:

| Renders | RTX 4070, Windows   | RX 6950 XT, Windows |
| ------- | ------------------- | ------------------- |
| 8       | 5.7-6.0, 190 ms     | 4.8, 62 ms          |
| 16      | 4.6, 292 ms         |                     |
| 32      | 3.0-3.4, 550-630 ms | 2.9, 190-215 ms     |
| 64      | 2.9, a 10 s freeze  |                     |

The live 1080p frame with DLSS measures 2.95: at 32 renders the capture only reaches the live
game's own mottle. SSGI's lighting itself changes the image little: the mean luma moves by 0.6/255
on the RTX 4070 and about 4/255 on the RX 6950 XT. AMD and Intel creators with SSGI on got the
grainy captures, since the setting was hidden from them and stored off.

Alternatives that were live:

- 32 renders while SSGI is on: triples the capture's freeze on NVIDIA, and the result still carries
  the mottle.
- Keeping SSGI with the upscaler left on: the upscaler renders below the target size, which the
  capture forces off for sharpness.
- Keeping the setting, shown on every GPU: its only effect is choosing grainy captures.

## Decision

The capturer turns SSGI off for every capture, on every GPU, and restores the player's level right
after, without saving: the game's option only changes what the player sees on screen. The
`DisableGlobalIllumination` setting, the upload panel's note that SSGI was disabled, and the
setting's field in the creator metadata are gone. The render condition
`capture.isGlobalIlluminationForcedOff` still records whether the player had SSGI on.

A Debug build keeps `CaptureWithGlobalIllumination` in the mod's Development options, and
`CaptureDebugProbe.RenderCountOverride`, to look at SSGI in captures again.

## Consequences

- No capture carries SSGI's indirect light, a small change in brightness on most scenes.
- A future HDRP or game update that fixes SSGI's convergence goes unnoticed unless someone
  re-measures with the Debug option (`docs/solutions/measuring-ssgi-grain-in-a-capture.md`).
