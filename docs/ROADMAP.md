# Roadmap

## Controller support in the main menu

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
