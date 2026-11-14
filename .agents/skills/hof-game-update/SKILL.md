---
name: hof-game-update
description: Bring the mod in line with a new Cities: Skylines II version, checking everything it copies from or anchors into the game. Use after the game updated, or when the UI harness, a vanilla module, the build or the mod's UI anchors break after a patch.
---

# After a game update

The mod copies some of the game and anchors into more of it; a patch can move any of them without a build error.
Go through every item, in order, and report each as unchanged, updated, or broken with what broke.
This skill is the list: when the mod starts or stops copying or anchoring into game code, or an update changes how a check runs, edit its item here in the same change.
The game must be closed for the build steps.

## 1. The toolchain and the local sources

- On Linux, `mise setup:linux` reinstalls the modding toolchain for the new version.
- Refresh the decompile and the readable copy of the game's UI bundle with the `cs2-modding-setup` skill: the checks below read them.

## 2. What the mod copies

- **cs2-types.** Copy the `.d.ts` files of `$CSII_INSTALLATIONPATH/Cities2_Data/Content/Game/.ModdingToolchain/npx-create-csii-ui-mod/template/types` over [`UI/cs2-types`](../../../HallOfFame/UI/cs2-types), as they are (git turns their CRLF into LF); `validateTypes.ts` stays out. Never edit them by hand: `mise check` then shows what the new types break.
- **Game version.** Set `GameVersion` in [`PublishConfiguration.xml`](../../../HallOfFame/Properties/PublishConfiguration.xml) to the new `<major>.<minor>.*` (the game's version is the `Game version` key of `~/.cs2-modding/setup.md`), when the minor moved.
- **Vanilla CSS variables.** Each value [`vanilla-vars.scss`](../../../HallOfFame/UI/src/vanilla-vars.scss) copies, rather than referencing its `var()`, is checked against the new bundle's stylesheet, and its trailing comment updated.

## 3. What the mod anchors into

- **The UI test harness.** `mise test:ui`: an "anchor not found" error means the bundle's React wrapper modules moved, and the `hof-ui-testing` skill's harness internals say how to find them again.
- **The vanilla stubs.** Each module path and export under [`UI/src/vanilla-modules`](../../../HallOfFame/UI/src/vanilla-modules) still exists in the readable bundle, with the props the stub declares. A missing one falls back at runtime and reports once in the game's error dialog, so a broken stub can pass every test.
- **The reflection accessors.** Each private member a class of [`Reflection`](../../../HallOfFame/Reflection) reaches still exists in the decompile under that name, with that signature: a missing one fails only when the mod first reaches it.
- **The capture's game code.** [`ScreenshotCapturer`](../../../HallOfFame/Systems/Capture/ScreenshotCapturer.cs) mirrors or relies on game code whose behaviour, not its signatures, can change: in the decompile repo (its root in `~/.cs2-modding/setup.md`), `git diff` the previous game version's commit against the new one, each named after its version, on the files of `ScreenCaptureHelper`, `Game.Settings.GraphicsSettings`, `AntiAliasingQualitySettings`, `SSGIQualitySettings`, `DynamicResolutionScaleSettings`, `UpscalerManager`, TND's `UpscalerContext`, `TNDUpscaler` and its bases `UpscalerController_HDRP` and `UpscalerController`, `HDAdditionalCameraData`, `Colossal.UI.UIView` and cohtml's `ViewCustomPassHDRP`. A tooling commit between the two versions (an ilspycmd update) rewrites lines the game never changed: read past that noise. Report each real change with the capture step it touches.
- **The UI anchors.** Every location the mod's registrars append to or extend is still a registry location in the bundle, and what the mod adds there shows in the game (step 5).
- **The toolchain hooks.** The csproj relies on the toolchain's `Mod.targets` (in `$CSII_TOOLPATH`) for the `DeployWIP` and `ModPostProcessorConfig` targets, the `NeedBuild` property its cleanup and post-build targets check, and the ` -p macOS` and ` -p Linux` flags of `ModPostProcessorArgs` the Debug Burst trim strips: each is still there under that name.
- **The pins.** The React version the game ships (the `"18.x.y"` string in `Cities2_Data/Content/Game/UI/index.js`) still matches the pin; [`dependency-updates.md`](../../../docs/agents/dependency-updates.md) holds every pin and what would let it move.

## 4. Every test layer

```
mise build
mise check
mise test
```


## 5. One game cycle

Run one cycle through the `cs2-dev` tools, `restart` with `mod` set to `HallOfFame` and a new city: the mod loads from the local build, its UI renders where it did, its settings page opens, and its log holds no error.
