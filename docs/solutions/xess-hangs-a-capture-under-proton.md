---
date: 2026-11-13
area: Systems/Capture
symptoms:
  - 'The game stops advancing frames on or right after the first capture of a session, XeSS on'
  - 'unity eval: main thread stayed inside engine or native code for 15s'
  - 'After a later capture the game runs at 3 fps until XeSS is switched off'
tags: [capture, xess, tnd, upscaler, proton, linux, dxvk, vram, hang]
retire_when: 'a Proton, DXVK, NVIDIA driver or game release newer than Proton Experimental 11.0-20261105c, NVIDIA 580.196.07 and game 1.6.4f1 lets XeSS survive a first 4K capture on an 8 GB NVIDIA card; check with three such captures, each on a fresh launch, cap lifted'
---

# XeSS hangs a capture under Proton

## Problem

On Linux under Proton, with an 8 GB NVIDIA card, XeSS hangs the game on or right after the first
4K capture of a session: frames stop for good, the main thread stuck in native code. XeSS is the
default upscaler on every card without DLSS (`UpscalerManager.kCandidatesByPriority`: DLSS4,
XeSS3, FSR3), so Linux players without DLSS start on it.
A later capture in a warm session once completed and left the game at 3 fps until XeSS was
switched off.

## What didn't work

The trap is a test that hides the hang:

- At debugger breakpoints, the precaution's sequence run by hand held 4 of 4, in sessions whose
  memory had already grown; the pause likely lets the GPU drain.
- Under a 10 fps frame cap (`dxgi.maxFrameRate` in `dxvk.conf`), the precaution held on one fresh
  capture and three warm ones; with the cap lifted it held once and hung on the next fresh capture.

That precaution switched XeSS off a frame before the renders, so its context was destroyed first,
and reset the render targets to screen size after them. Every point it tried for bringing XeSS
back hung a fresh first capture at least once: the frame the capture restores the game, the full
image's readback done, and that readback followed by 5 s of frames under 250 ms each. Uncapped,
frames stayed under that bound while the GPU was still at 98-100 %, so the rule fired before the
GPU had settled.

## Root cause

Unproven. The hang follows XeSS's context being created right after a render larger than the
screen, while DXVK still churns from the capture's peak at the VRAM ceiling (GPU at 100 %, PCIe
busy). Power during the hang varies: 12-15 W with the GPU clock at 500-1000 MHz in some, about
30 W with GPU use near 45 % in others. In every hang the card stood at 7.6-7.8 GB of 8 once XeSS's
context existed; every return that ran left it at 7.5 GB or under. Unlike the crawl in
[Captures break at the VRAM ceiling](captures-break-at-the-vram-ceiling-under-proton.md), frames
never resume.

- It hangs with no mod code (the game's own `ScreenCaptureHelper.CaptureScreenshot` into a
  3840x2160 target, XeSS left on, about a minute later), and with no capture (XeSS switched on at
  the VRAM ceiling).
- Never seen on Windows with the same GPU, the mod's own capture included (memory at 6.3-7.4 GB,
  the ceiling not reached), on an RX 6950 XT under Windows, nor on an Intel Iris Xe under Proton
  (two captures). Untested on Linux AMD.
- Whether DXVK's memory defrag plays a part is unknown: no run had `dxvk.enableMemoryDefrag = False`.

## Fix

None in the mod. Two leads held, each once and under the conditions above: XeSS switched back on
by hand more than 20 s after the game was back at its normal pace ran (capped), and one render at
screen size with XeSS toggled off around it did not hang (by hand, at a breakpoint).
With the upscaler off, DLSS4 or FSR3, captures on the same laptop did not hang this way (capped
runs); the failures of
[Captures break at the VRAM ceiling](captures-break-at-the-vram-ceiling-under-proton.md) still
apply to them, and XeSS switched back on later in that session can hang.

## Prevention

Prove a change here on fresh-session first captures, the frame cap lifted, no breakpoints, the
game window kept on top.
