---
date: 2026-11-13
area: Systems/Capture
symptoms:
  - 'A capture with the water gone (sand), no shadows, a frame blown out to white, or water shaded pale or black'
  - 'The live game left with no shadows anywhere and blank icons at 2 fps until a restart'
  - 'The game crawls or stops advancing frames after many captures in a row, GPU at 100 %'
tags: [capture, vram, dxvk, proton, linux, defrag, relocation, dlss, rthandles, hang, corruption]
retire_when: 'a Proton release ships a DXVK with doitsujin/dxvk PR #6042'
---

# Captures break at the VRAM ceiling under Proton

## Problem

On Linux under Proton, with an 8 GB NVIDIA card, a capture's 4K render takes the game to its VRAM
ceiling. Two failures follow: some captures render broken and leave the live game broken until a
restart, and after enough captures the game crawls to a hang.

## What didn't work

- A stress loop freeing and recreating the 4K render targets every round crawls within a few rounds
  whatever the setting, so it measures the crawl and never reaches the corruption.
- Comparing runs with the game window covered: under vsync a covered window renders at 1 fps, which
  changes every timing.
- Capturing on a fixed interval: the clear lands before the PNG is written and cancels the encode.
- Resetting the render targets after every capture (`RTHandles.maxWidth/maxHeight` saved before,
  `HDRenderPipeline.ResetRTHandleReferenceSize` in the capture's `finally`): memory stays flat
  between captures, but each capture still peaks at the ceiling and the breaks kept coming.

## Root cause

Two DXVK bugs in moving resources corrupt them at the ceiling, triggered by its defrag and eviction
(`dxvk.enableMemoryDefrag`, on by default): a relocation batch can copy one resource several times
with no barrier between the copies, and the eviction scan can evict a resource in use.
doitsujin/dxvk PR #6042 fixes both. Matched runs of 260 captures, on a build that switched the
upscaler off and on and reset the render targets per capture: 22 broken with defrag on, 0 with it
off. Earlier runs at a fixed interval, defrag on, broke about 1 in 60 (4 of 259), with the reset or
with the targets held at 4K. The corruption only showed in builds that switch the upscaler per
capture: with no switch, none of 261 captures broke, 113 of them on the released 2026.6.2 (DLSS kept
on, no reset), which hung instead, after 15 captures with its window covered and 78 with it on top.

The crawl is separate: DXVK moves resources to system memory (GPU at 100 %, the PCIe link busy). It
happens with defrag on or off, and worse with it off. Whether it happens on Windows is unmeasured.
With XeSS running, a first capture stops the game for good at the same ceiling:
[XeSS hangs a capture under Proton](xess-hangs-a-capture-under-proton.md).

## Fix

None in the mod yet: releasing the 4K render targets when photo mode closes is the option left,
and a capture would still peak at the ceiling.
A DXVK built from PR #6042, its `d3d11.dll` and `dxgi.dll` in the game folder, stops the
corruption alone, which tells it from a mod bug. `dxvk.enableMemoryDefrag = False` stops it too, but
slows captures and worsens the crawl.

## Prevention

Test a capture change for corruption with matched runs differing in one setting, each on a fresh
launch with the same save, camera and pinned time of day, the window kept on top:

- Chain the captures in the UI: start the next once `hallOfFame.capture.screenshotSnapshot` reports
  `isImageReady`, clear it a second later, take the next two seconds after, with a two-minute
  watchdog.
- Score each capture with ImageMagick: the mean color of a box of open water (sand when red exceeds
  blue, white when red and blue are both high), and the dark-pixel fraction of a box holding a
  shadow (under 1 % means no shadows).
- Then the RMSE at 480 px wide against the run's first capture: a good capture sits under 0.01,
  a broken one above 0.02, often near 0.15. It also catches wrong water shading and exposure.
