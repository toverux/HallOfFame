# Hall of Fame for Cities: Skylines II

A Cities: Skylines II mod that allow players to take and upload screenshots of
their city, and share them with the community.

Screenshots are uploaded to a server, and can be viewed by other players as a
background image in the main menu, with information about the creator, the city
name, and controls to refresh the image, upvote or hide the UI to better see the
image, to name a few features.

For fellow CS2 modders in search of code samples, the source code notably features:
 - A C# and UI mod;
 - Use of React portals and manual DOM manipulation to patch specific parts of
   the game's UI that aren't exposed in the modding API;
 - [Harmony](https://harmony.pardeike.net/index.html) transpiler patches for
   .NET IL-level modding;

## Installation

 - Standard CS2 modding toolchain;
 - `npm i` in `HallOfFame/UI` to install UI mod dependencies.
 - Recommended: enable `--developerMode --uiDeveloperMode` as game launch options.

Here's a game launch command to also skip launcher in Steam:

```sh
"C:\Program Files (x86)\Steam\steamapps\common\Cities Skylines II\Cities2.exe" %command% --developerMode --uiDeveloperMode
```

## Development

The UI mod will be built automatically with the C# solution.

However, if you are actively working on the UI, you may recompile it on change
with `cd HallOfFame/UI && npm run dev`.

You can also enable the game's live reload feature in the options and set
File tracking to All.

Debugging C# code can be done following these steps:
https://cs2.paradoxwikis.com/Debugging.

Debugging JS code can be done with the browser's dev tools by opening http://localhost:9444
(sadly not working well on Firefox, Chrome is recommended).

Logs are situated in either:
 - `%appdata%\LocalLow\Colossal Order\Cities Skylines II\Player.log`
 - `%appdata%\LocalLow\Colossal Order\Cities Skylines II\Logs\UI.log`
 - `%appdata%\LocalLow\Colossal Order\Cities Skylines II\Logs\HallOfFame.Mod.log`

## Publishing a new version

 - Update `ModVersion` and `ChangeLog` in `PublishConfigurations.xml`;
 - Update version in `mod.json`;
 - @todo

## Code style

### TypeScript

TypeScript code is formatted and linted by [Biome](https://biomejs.dev).
Run `npm run check` to check for linting errors, format files and autofix simple issues.

You can also use Biome directly with `npx biome`.

The formatter and linter should run as a pre-commit hook if you have it installed,
which should be done automatically when running `npm i` (otherwise run `npx lefthook install`).

I'd suggest to use a Biome plugin for your editor to ease development.

If a rule seems out of place for this project, you can either disable/reconfigure
it in the `biome.json` file or disable it with an annotation comment, but these
should be justified and concerted.

### C#

For C#, prefer using Rider, as code style and linting settings are saved in the project.
Reformat your code before committing (CTRL+ALT+L with Rider).

At the very least, please ensure your IDE has `.editorconfig` support enabled.

### Commit messages

Commits must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0) specification and more
specifically the Angular one.

Scope can be one or more of the following:
 - `mod`: for general changes to how the mod "presents itself" to the game or user;
 - `cs`: for C# mod changes;
 - `ui`: for UI mod changes;
 - `i18n`: for changes in translations and translations system;
 - `deps`: for dependencies updates;
 - Propose new scopes if needed!
