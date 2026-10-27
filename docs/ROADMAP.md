# Roadmap

Planned work on the mod that no ticket holds yet.

Every entry opens with a triage line: **Priority** (high, medium, low) and **Cost** as the code reads at triage (trivial, cheap, moderate, large), either one `unsure` when nobody has judged it yet.

## The Greenfield template's improvements, ported wholesale

**Priority:** high · **Cost:** moderate

`../cs2-greenfield-mod-template` started from Hall of Fame's layout and tooling (its commits `4afa798` to `37e03ec`), then kept improving on them. Port all of it back: every file, from `lefthook.yml` and `mise.toml` to the mod code, translated to Hall of Fame's names (`Greenfield` to `HallOfFame`, `gfd-` to `hof-`) and places (`.agents/` for skills, rules and scripts). Only what exists to make or maintain the template stays out: `template/`, the `gfd-setup` wizard, its `LICENSE`, and the entity counter sample slice.

What Hall of Fame lacks entirely, as of template commit `8ecc1ff`:

- The shared C# build settings in `Directory.Build.props` and `Directory.Build.targets`, with the `.editorconfig` code style enforced on every build.
- C# tests on xUnit v3 and .NET 10 rather than `net48`, with the Unity native-memory shim (`Shim/`) and the float64 pass (`Float64/`, `mise test:cs:float64`, `scripts/check-float64-output.ts`). This adds dependencies and rewrites the test setup the `hof-cs-offengine-testing` skill and `AGENTS.md` describe.
- In-game scenarios run unattended (`Scenarios/`, `scripts/game.ts`, `scripts/test-game.ts`, the game and scenario log parsers, `mise test:game`, `mise game`), with the `gfd-game-testing` and `gfd-game-cycle` skills.
- The `gfd-game-update` and `gfd-template-update` skills, the `PublishNewMod` profile, `NullStrings`, and tests Hall of Fame has no equivalent of (`ModLog`, `LocaleLoader`, `AlwaysFalseEqualityComparer`, the UI's `game-setup`).

Most files the two repositories share also differ: `Settings.cs`, the csproj files, `CommonUISystem.cs`, `LocaleLoader.cs`, `Mod.cs`, `mise.toml`, `build.ts`, `AGENTS.md`, the translate, release and testing skills, `lefthook.yml`. Diff each one, take the template's side, and keep what is Hall of Fame's own, since some of those differences are features the template never had.

Finish by writing a `.template.json` that points at the ported template commit, so `gfd-template-update` can bring later template commits over one by one.

## The upload panel's maximized image as a component

**Priority:** unsure · **Cost:** cheap

The upload panel's maximize button shows the capture full screen through `showFullscreenImage` (`area-game/screenshot-upload-panel/panel-image.tsx`): a `div` appended to `document.body` outside React, which a click anywhere removes. The image covers every piece of UI and shows no way out, so it is easy to take for a crashed UI. Make it a React component with a big X close button, closing on Back as well.

The Creator Dashboard's detail view can then use the same component to show its image full screen.

## The details window's Description tab as an Information tab

**Priority:** unsure · **Cost:** moderate

The slideshow's details window (`components/screenshot-details/screenshot-details-window.tsx`) opens on a Description tab that shows the creator's text, or an empty state when there is none. Make it an Information tab that always has content: the description first when there is one, then what the screenshot payload already holds and the slideshow only half shows:

- The medal with its band and the Popular note, as the Creator Dashboard's detail caption words them.
- The city: milestone, population, map, and the exact upload date where the labels give how long ago.
- The figures: views, unique views, likes, and the like rate on a ranked screenshot.
- The creator, linking to their Web Viewer page, and the showcased mod when there is one.
- A summary of the conditions (hour, season, weather) that links to the Photo Settings tab, and the playset size that links to the Playset tab.

Build it from the dashboard detail's pieces (`components/creator-dashboard/dashboard-detail.tsx`: `DetailFact`, the medal summary, the figure groups), moved to shared components rather than copied. The tab key `TAB[Description]` becomes `TAB[Information]`, and the no-description empty state goes.

## Controller support in the main menu

**Priority:** unsure · **Cost:** unsure

On hold until the gamepad telemetry shows whether enough players use a controller to justify it. `UpdateMe` sends `isGamepadConnected` in the creator's `metadata`: whether a gamepad was connected at the last sync, a rough proxy for controller use, since a connected pad may sit idle and one connected after the sync goes unseen.

If connected pads turn out to be a significant share, measure actual use next with a sticky `hasUsedGamepad` key:

- The game boots on the keyboard and mouse scheme and switches to `Gamepad` only once a pad is touched (`InputManager.OnDeviceActivated`). So `isGamepadControlSchemeActive` reads false at the startup sync, and the switch is the moment to report.
- On the first `InputManager.EventControlSchemeChanged` to `Gamepad`, run a silent full sync (a new `CreatorSyncTrigger`) that sends `hasUsedGamepad: true`, then unsubscribe. That costs at most one extra request per controller session.
- Include the key only while it is true. The server merges `metadata` over the stored one, so an omitted key keeps its last value, while a `false` sent by the next startup sync would erase it.
- Fire it only once the startup sync has finished: `CreatorIdentity.Sync` cancels the sync in flight, and cancelling the startup one leaves the Options panel's login status on "Loading".

What is already known, checked against game 1.6.2f1:

- The slideshow actions (Previous, Next, Like, Toggle Menu, Screenshot Details) only have keyboard bindings. On a controller, none of them can be triggered directly.
- The main menu's button prompts (its action hint bar) render only while the gamepad is the active control scheme (`menu-ui.tsx`, `useGamepadActive`). They list only an action's gamepad bindings (`InputHintBindings.CollectHintItems`), so a keyboard-only action never shows up there.
- An action appears in the prompts when it has a gamepad binding, is enabled, and carries a `DisplayNameOverride` with a priority above 0. The prompt's label is the localization key `Common.ACTION[<display name>]`.
- A mod declares a gamepad binding with `SettingsUIGamepadAction` on the settings class and `SettingsUIGamepadBinding` on a second `ProxyBinding` that shares the keyboard binding's action name. Traffic's `ModSettings.Keybindings.cs` does this.
- In the main menu's usage, Select/View is the only free gamepad button: photo mode is its only other user. A, B, X, Y, the shoulders, the triggers, Start, the d-pad and the right stick are all taken.
- The slideshow controls sit outside the focus path the main menu drives (`docs/solutions/back-never-reaches-the-slideshow-controls.md`). The details row is a vanilla button, like the round buttons next to it, but no one has checked yet whether the d-pad can reach any of them.
- The details window handles Switch Tab in its always-active input consumer, so the shoulder buttons should switch tabs. That has not been tested on a controller either.

To read the game's live binding table, run `Game.Input.InputManager.instance.GetBindings(PathType.Effective, BindingOptions.ExcludeDummy)` over the Unity debugger and write it to a file with `String.Concat<ProxyBinding>`. In the output, usage `0` is the main menu.

## Saved photo mode settings

**Priority:** unsure · **Cost:** unsure

The details window's photo mode settings tab is read-only. The follow-up is letting a player keep a screenshot's settings and apply them in their own photo mode:

- A save action on the photo mode settings tab, writing a preset to `ModsData/HallOfFame/SavedPhotoModeSettings`.
- An in-game management UI, reachable from photo mode, to list, rename, delete, and apply the saved presets.

What is already known from the decompile, not yet measured in a running game:

- The game has no photo mode preset of its own: its "presets" are only the sensor size dropdown.
- A value is applied with `PhotoModeRenderSystem.photoModeProperties[id].setEnabled(true)` then `.setValue(v)`, and only shows while photo mode is active. Closing photo mode clears every override.
- "Time of Day" and "Simulation Speed" write to the simulation itself, so applying them has side effects outside photo mode.
- A preset never reproduces a look by itself: the hour, the map's latitude, the season, and the weather decide the light. The apply flow has to say so, as the tab does.

## Skyve playset download

**Priority:** unsure · **Cost:** unsure

A button on the details window's Playset tab that saves the screenshot's mod IDs as a text file, one ID per line, for Skyve to import as a playset. Skyve's import format and where the file should land are still to check against Skyve's own documentation and source.
