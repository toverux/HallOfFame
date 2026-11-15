---
date: 2026-11-15
status: accepted
area: Systems/Capture
---

# No workaround for XeSS hanging a capture under Proton

## Context

On Linux under Proton, an 8 GB NVIDIA card with XeSS on hangs the game on or right after the first
4K capture of a session (`docs/solutions/xess-hangs-a-capture-under-proton.md`). XeSS is the
default upscaler on every card without DLSS, while NVIDIA RTX cards start on DLSS4: the hang is
known only for NVIDIA players who switch to XeSS, and Linux AMD players, who start on it, are
untested. It was never seen on Windows nor on an Intel Iris Xe under Proton.

What was tried or measured, each against fresh first captures:

- A precaution that switched XeSS off before the renders and back on after: every return point
  tried (the restore frame, the readback's end, the readback plus 5 s of normal-pace frames) hung
  at least once.
- The 3840x2160 capture size and the render target reset on photo mode close: the build carrying
  both still hung on its first capture, which peaked at 7.8 GB; the reset only acts once photo
  mode closes, after it.
- DXVK's relocation fix (PR #6043, on Proton's DXVK base): still hung.

Alternatives that were live:

- A warning before the press for XeSS players under Wine: it needs a Wine check (`ntdll`'s
  `wine_get_version`) whose Windows side is unverified, and it can only tell players to switch
  XeSS off themselves.
- A capture below 3840 wide: the server keeps every image at least 3840x2160, and the hang comes
  without a capture anyway.

## Decision

The mod does nothing for XeSS under Proton: it captures with the player's upscaler as on any other
platform.

## Consequences

- A Linux player on an 8 GB card with XeSS on may lose the session on a first capture, with no
  word from the mod.
- The cause lies below the mod (Proton, DXVK, XeSS or the driver); the solutions doc's
  `retire_when` names the check that tells a release fixed it.
