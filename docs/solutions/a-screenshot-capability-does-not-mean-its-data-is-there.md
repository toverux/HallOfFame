---
date: 2026-10-05
area: UI/screenshot-details
symptoms:
  - 'A "predates the feature" message shows on a screenshot uploaded after the feature shipped'
tags: [capabilities, server, empty-state, render-conditions]
---

# A screenshot capability does not mean its data is there

## Problem

A UI state keyed on "no data" claimed the screenshot predated the feature. The same state shows on
screenshots uploaded after it, where the claim is false.

## Root cause

The server grants a capability by upload date alone
(`../HallOfFameServer/projects/server/services/screenshot.service.ts`, `capabilitiesSince`:
`screenshot.createdAt >= since`), and the fields behind it are optional on upload. So a capability
only says the screenshot is recent enough to carry the data. It arrives with an empty value when:

- an older mod version uploads after the server gained the feature;
- the mod's read fails at capture, as `RenderConditionsReader.Read` clearing its map in its catch.

## Fix

Word the empty state for every way it is reached ("The conditions of this shot were not
recorded"), in place of one cause ("taken before Hall of Fame recorded").

## Prevention

A missing capability proves the screenshot predates a feature; an empty value proves nothing about
when it was taken. Key a "predates" message on the capability, and anything keyed on the value
stays neutral about the cause.
