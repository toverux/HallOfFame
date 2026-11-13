# Roadmap

Planned work on the mod that no ticket holds yet.

Every entry opens with a triage line: **Priority** (high, medium, low) and **Cost** as the code reads at triage (trivial, cheap, moderate, large), either one `unsure` when nobody has judged it yet.

## The Creator Dashboard's image full screen

**Priority:** unsure · **Cost:** cheap

The Creator Dashboard's detail view (`components/creator-dashboard/dashboard-detail.tsx`, `DetailImage`) shows its image at FHD inside the panel, with no way to enlarge it. Give it an enlarge action that shows `imageUrl4K` through the full-screen image component planned for the upload panel, once that component exists.

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

## A screenshot as the desktop wallpaper

**Priority:** unsure · **Cost:** cheap

A slideshow action next to Save that makes the current screenshot the Windows desktop wallpaper. `SlideshowUISystem.SaveScreenshot` already downloads the 4K image through `ScreenshotExporter`: write it to one fixed file under `ModsData/HallOfFame` instead, so each new wallpaper replaces the last, then apply it with `user32`'s `SystemParametersInfo(SPI_SETDESKWALLPAPER, 0, path, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE)`. It needs new locale keys and a success notice.

Under Proton the call reaches Wine's desktop rather than the player's, so on Linux it likely does nothing visible; nobody has checked yet.

The Wallpaper Engine wallpaper in `../HallOfFameServer/docs/ROADMAP.md` is the live, rotating counterpart.

## A JSON mapper of our own

**Priority:** low · **Cost:** moderate

Colossal.Json's `Make` resolves every JSON key by reflection it never caches, scanning each member's attributes for a `[DecodeAlias]`, so it decodes about one object per millisecond. Decoding off the main thread keeps the frame rate, but a big playset still takes seconds to appear: with 2,256 mods, `Make` took about 2.5 s off-engine and the Playset tab showed its rows 7.7 s after the click in game. Mapping the same response by hand took 13 ms.

Replace `variant.Make<T>()` in `HttpQueries.DecodeJson` with a generic mapper that reads a type's `[DecodeAlias]` properties once and caches, per JSON key, a setter and a decoder for its value. It needs no code per domain class, only a case per kind of value: `string`, `int`, `bool`, `DateTime`, arrays, `List<T>`, `Dictionary<string, T>`, nested records, and types carrying `[JsonConverter]` (`RenderConditions`). Its cache must be thread-safe, since decoding runs on a worker thread. Off-engine tests decode each `Domain` type through both `Make` and the mapper and compare the results; `DateTime` parsing and a `null` on a non-nullable member are the parity cases nobody has checked yet.

## In-game test scenarios

**Priority:** unsure · **Cost:** unsure

Investigate where the game's own test framework, run through the `cs2-dev` MCP server's `test` tool, would test what off-engine tests cannot: the capture systems (`Systems/Capture`) and photo mode over a loaded city, the screenshot pipeline end to end. The Greenfield template ships the setup as its `game-tests` part (`Scenarios/`, the `game-testing` skill, the `Colossal.TestFramework` reference); this mod pruned it, so adopting it means taking that part back from the template.

## Downloading your own pictures from the Creator Dashboard

**Priority:** unsure · **Cost:** unsure

A creator can edit and delete their screenshots from the Creator Dashboard's detail view (`components/creator-dashboard/dashboard-detail.tsx`), but cannot get the pictures back, for example after reinstalling the game or on another machine. Add a download action there that saves the screenshot's largest image, `imageUrl4K`, into the game's screenshots folder (`Mod.GameScreenshotsPath`), where a capture's local copy already goes (`CaptureUISystem.WriteLocalScreenshot`).

## A refused upload's reason in its usage event

**Priority:** unsure · **Cost:** unsure

The `upload_finished` event planned for the next release names a refused upload `rejected`, with no reason: `HttpQueries.JsonError` carries only the message, and the server answers nearly every refusal with a 400. Telling a moderation refusal, a ban and a limit apart needs the server to send a machine-readable kind first, which is a wire format change. The Feature usage dashboard's capture funnel in `../HallOfFameServer` can then split the missing screenshots by outcome and reason.

## Info views in a capture

**Priority:** unsure · **Cost:** unsure

Let a creator take a picture with an info view on, such as electricity or traffic flow, to show how their city works. Today a capture shows none: photo mode sets `RenderingSystem.hideOverlay` while it is open (`PhotoModeUISystem`), and the capture sets it too and turns off the "Outlines Pass" around its renders (`ScreenshotCapturer`).

To find out first:

- Which parts of an info view survive `hideOverlay`: the world tint, and the overlays some views draw (flow arrows, icons). Then which of them reach an offscreen 4K render.
- Whether a view chosen through `ToolSystem.infoview` stays active and visible in photo mode, or the capture has to switch it on around its own renders and back off after.
- Where the creator picks the view (a control in photo mode or on the capture button), and whether the server and the viewers should know a screenshot has one.

## The UI's errors in Sentry, caught and readable

**Priority:** unsure · **Cost:** moderate

The error reporting planned for the next release sends the UI errors `logError` receives (`utils/ui-helpers.ts`), with minified stacks, and misses the rest: an uncaught error, a rejected promise, a render that throws.

- Catch them with a `window` error handler and an error boundary, keeping only the errors whose stack names the mod's bundle: the game's UI and every mod share the page.
- Make the stacks readable: the build writes a source map per published version, kept out of the shipped mod, and the release uploads it to Sentry with `sentry-cli`.
- Two blind spots stay to look at: a UI module that throws while loading, which the game's loader swallows (`docs/solutions/mod-ui-vanishes-when-its-module-throws-on-load.md`), and an error raised before the settings load, when the player's consent is not known yet.
