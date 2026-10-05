---
date: 2026-10-01
area: HallOfFame.Tests
symptoms:
  - 'System.BadImageFormatException : Method has zero rva'
tags: [build, msbuild, test-harness]
updated: 2026-10-05
---

# Every test fails with "Method has zero rva"

## Problem

The whole C# suite fails at once with `System.BadImageFormatException : Method has zero rva`, one
failure per test. It reads like the test assembly is corrupt, which sends the search to whatever
code changed last.

## What didn't work

Reading the code that changed. The edit was correct, and nothing in the diff was the cause.

## Root cause

Stale build output under `HallOfFame.Tests/obj`. The incremental build reuses artifacts that no
longer match the sources, most readily after a bulk edit that rewrites many files at once.

## Fix

Rerun the suite first: the failure is often transient and a second `mise test:cs` passes. When it
does not:

```bash
rm -rf HallOfFame.Tests/obj HallOfFame.Tests/bin
```

## Prevention

Read the failure count before the diff: every test failing identically points at the build, where a
logic error fails a related few.
