---
date: 2026-11-15
status: accepted
area: Systems/Capture
---

# Shrink the render targets when photo mode closes, on every platform

## Context

HDRP sizes the render targets every camera shares (`RTHandles`) to the largest render it has seen
and never shrinks them, so a 4K capture leaves the game drawing into 4K targets for the rest of the
session. On an 8 GB card under Proton that holds the game at DXVK's memory budget, where it crawls
and its rendering can break (`docs/solutions/captures-break-at-the-vram-ceiling-under-proton.md`).
On Windows the memory costs nothing visible, but the oversized targets cost GPU time each frame:
measured on an RTX 4070 8 GB, 7 % of the frame rate at 1080p and 4-5 % at 1440p; nothing on an
RX 6950 XT whose GPU was not saturated.

`HDRenderPipeline.ResetRTHandleReferenceSize` shrinks them. The reset costs a frame of 0.1-0.2 s,
plus about 0.6 s at a session's first reset, most of it in
`HDCamera.ResetAllHistoryRTHandleSystems`, whether a capture came before it or not.

Alternatives that were live:

- A reset after every capture: each capture's renders took 1.2-2.9 s instead of 70-145 ms, and every
  capture still peaked at the memory ceiling.
- The reset on Linux only: Windows pays the per-frame GPU cost too.
- A warm-up reset at screen size during the city load, to pay the first reset's 0.6 s where nobody
  sees it.
- A reset only when a capture grew the targets, which needs the capture to record it.

## Decision

`RenderTargetShrinker` resets the render targets to the screen size when the photo mode panel
closes, on every platform, whenever they are larger than the screen: captures in a row stay fast,
the game leaves the ceiling between photo sessions, and oversized targets cost the same GPU time
whoever grew them. The warm-up reset was left out by Morgan's choice: the first reset's 0.6 s is
paid once per session, at a photo mode close.

## Consequences

- The next photo session's first capture pays the regrowth (on Linux its freeze reaches 1.5-1.6 s,
  against 155 ms warm; on Windows its renders cost nothing more).
- A photo mode close after the player lowered the resolution pays one reset frame with no capture
  behind it.
- Loading a save or quitting to the menu with photo mode open closes it through
  `GamePanelUISystem.PreDeserialize`, which raises no `eventPanelClosed`: the targets stay large
  until photo mode closes again, as every session did before the shrinker. Accepted, not handled.
